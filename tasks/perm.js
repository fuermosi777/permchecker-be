var moment = require('moment-timezone');
var axios = require('axios');
var { Employer, Case, Cookie, sequelize } = require('../models');
var winston = require('winston');
var { track, EVENT, TYPE } = require('../utils/tracker');
var puppeteer = require('puppeteer');

const ROWS = 100;
const DOL_PERM_LANDING_PAGE_URL = 'https://lcr-pjr.doleta.gov/index.cfm?event=ehlcjrexternal.dsplcrlanding';

/**
 * @typedef {[number, string, string, string, string, string, string, string, string, string, number, string, string]} Row
 * 
 * @typedef {Object} Data
 * @property {number} TOTAL
 * @property {number} RECORDS
 * @property {string} CREATE_DATE
 * @property {string} POST_END_DATE
 * @property {string} STATE
 * @property {number} PAGE
 * @property {string} POST_END_DATE
 * @property {string} LCJR_ID
 * @property {Row[]} ROWS
 */

function delay(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

/**
 * Convert raw date text to PST date time
 * @param {string} dateRaw MM/DD/YYYY
 * @return {Date}
 */
function castDateToAmerica(dateRaw) {
  return moment.tz(dateRaw, 'MM/DD/YYYY', 'America/Los_Angeles').toDate();
}

/**
 * @return {object}
 */
function getYesterdayDate() {
  return moment().tz("America/Los_Angeles").subtract(1, 'day');
}

/**
 * @param  {object} date
 * @param  {number} page
 * @return {string}
 */
function getUrl(date, page) {
  return `https://lcr-pjr.doleta.gov/index.cfm?event=ehLCJRExternal.dspQuickCertSearchGridData&startSearch=1&case_number=&employer_business_name=&visa_class_id=6&state_id=all&location_range=10&location_zipcode=&job_title=&naic_code=&create_date=undefined&post_end_date=undefined&h1b_data_series=ALL&start_date_from=${date.format('MM/DD/YYYY')}&start_date_to=${date.format('MM/DD/YYYY')}&end_date_from=mm/dd/yyyy&end_date_to=mm/dd/yyyy&page=${page}&rows=${ROWS}&sidx=create_date&sord=desc&_search=false`;
}

/**
 * @param {object} date Moment object
 * @param {number} page
 */
async function fetchDataAt(date, page) {
  if (!date || !(date instanceof moment)) throw new Error('incorrect date format');
  if (page < 1 || !Number.isInteger(page)) throw new Error('incorrect page number');

  let url = getUrl(date, page);
  let cookie;

  // console.log(url);
  try {
    let cookieRecord = await Cookie.findAll({limit: 1, order: [[ 'createdAt', 'DESC' ]]});

    if (cookieRecord.length === 0) {
      throw new Error('No cookie found in database');
    }

    cookie = cookieRecord[0].content;

  } catch (err) {
    throw err;
  }

  try {
    // @ts-ignore
    let result = await axios.get(url, {
      headers: {
        Cookie: cookie
      }
    });

    if (result.hasOwnProperty('data')) {

      /** @type {Data} */
      let data = result.data;

      if (data.RECORDS === 0) throw new Error('data is empty');

      winston.log('info', 'data fetched success', {
        date: date.format(),
        total: data.RECORDS,
        page: `${page}/${data.TOTAL}`
      });

      if (!data.TOTAL) {
        throw new Error('Shit happens! Data is incorrect');
      }

      /** @type {Row[]} */
      let rows = data.ROWS;

      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let [internalId, caseNumber, postingDate, caseType, status, employerName, workStartDate, workEndDate, jobTitle, state, visaClass, jobOrder, htmlTag] = row;

        let employer = await Employer.findOne({where: {name: employerName}});

        if (employer) {
          winston.log('warning', 'employer already exist', {employerName});
        } else {
          employer = await Employer.create({name: employerName});
          winston.log('info', 'employer created', {employerName});
        }

        let perm = await Case.findOne({ where: { caseNumber}});

        if (perm) {
          winston.log('warning', 'case already exist', {caseNumber});
        } else {
          perm = await Case.create({
            internalId, caseNumber, 
            postingDate: castDateToAmerica(postingDate), 
            caseType, status, employerId: employer.id, 
            workStartDate: castDateToAmerica(postingDate), 
            workEndDate: castDateToAmerica(postingDate), 
            jobTitle, state, jobOrder
          });
          winston.log('info', 'case created', {caseNumber});
        }
      };

      let hasNextPage = data.PAGE < data.TOTAL;

      if (hasNextPage) {
        return await fetchDataAt(date, page + 1);
      } else {
        winston.log('info', 'stop fetching');
        return Promise.resolve(data.PAGE);
      }
    } else {
      throw new Error('data is empty');
    }
  } catch (err) {
    throw err;
  }
}

async function crawlLatest() {
  const yesterday = getYesterdayDate();
  winston.log('info', 'perm crawl latest start', {date: yesterday.format()});
  track(EVENT.CRAWL_PERM_STARTED, TYPE.INFO);
  let page;

  try {
    page = await fetchDataAt(yesterday, 1);
  } catch (err) {
    track(EVENT.CRAWL_PERM_FAILED, TYPE.ERROR, {err: err.message});
    winston.log('error', 'perm fetch data failed', {err: err.message});  
  }

  track(EVENT.CRAWL_PERM_DONE, TYPE.INFO, {page});
  winston.log('info', 'perm fetch data done', {page});  

  setTimeout(() => {
    process.exit();
  }, 1000);
  // sequelize.close();
}

/**
 * @param {object} from Moment
 * @param {object} to Moment
 */
async function crawlAllBetween(from, to) {
  winston.log('info', 'perm crawl between start', {from: from.format(), to: to.format()});

  let flag = from;
  while (flag.isBefore(to)) {
    try {
      await fetchDataAt(flag, 1);
    } catch (err) {
      winston.log('error', 'perm crawl within range one day fail', {err: err.message});
    } finally {
      flag.add(1, 'days');
    }
  }

  winston.log('info', 'perm crawl within range done');

  process.exit();
}

/**
 * @async Should run locally
 */
async function getReCaptchaCookie() {
  let browser;
  try {
    const browser = await puppeteer.launch({
      headless: false,
      timeout: 5 * 60 * 1000 // 5 min
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(5 * 60 * 1000);
    page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36');
    await page.goto(DOL_PERM_LANDING_PAGE_URL);
    page.setViewport({width: 1400, height: 900});

    const frame = await page.frames().find(f => /.*www\.google\.com\/recaptcha.*/.test(f.url()));
    await delay(2000);

    await frame.waitForSelector('#recaptcha-anchor');
    const checkbox = await frame.$('#recaptcha-anchor');
    await checkbox.click();

    await delay(4000);

    let cookies = await page.cookies();
    let cookieStr = cookies.reduce((a, b) => {
      return `${b.name}=${b.value}; ${a}`;
    }, '');

    let button = await page.$('#submitButton');

    await button.click();
    await page.waitForNavigation('domcontentloaded');

    console.log('+++ ' + cookieStr + ' +++');

    if (cookieStr) {
      // @ts-ignore
      await axios({
        method: 'post',
        url: 'https://www.permcheckerapp.com/api/cookies',
        data: {
          content: cookieStr,
          internalKey: process.env.PERMCHECKER_BE_INTERNAL_KEY
        }
      });
    }

    await browser.close();
  } catch (err) {
    winston.log('error', 'Cookie fetch failed', {err: err.message});
    process.exit();
  }
}

/**
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 */

let args = process.argv.slice(2);
let subcommand = args[0];

if (subcommand === 'latest') {
  crawlLatest();
} else if (subcommand === 'between') {
  let from = args[1];
  let to = args[2];
  crawlAllBetween(moment(from).tz('America/Los_Angeles'), moment(to).tz('America/Los_Angeles'));
} else if (subcommand === 'cookie') {
  getReCaptchaCookie();
} else {
  process.exit();
}

// fetchDataAt(moment('2017-10-16').tz("America/Los_Angeles"), 1).then(() => {
//   sequelize.close();
// });
// crawlLatest();
// crawlAllBetween(moment('2017-10-10').tz("America/Los_Angeles"), moment('2017-10-16').tz("America/Los_Angeles"));
// Employer.findAll({where: {name: '123'}});
