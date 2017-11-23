var moment = require('moment-timezone');
var axios = require('axios');
var { Employer, Case, sequelize } = require('../models');
var winston = require('winston');
var { track, EVENT, TYPE } = require('../utils/tracker');

const ROWS = 100;

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

  console.log(url)

  try {
    // @ts-ignore
    let result = await axios.get(url, {
      headers: {
        Cookie: 'CFID=3329303; CFTOKEN=27791875; _ga=GA1.2.1582600602.1508110795; _gid=GA1.2.947110993.1511464025; NSC_TJMMKDSXFC_443_MC=ffffffff09391c5145525d5f4f58455e445a4a423660'
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
} else {
  process.exit();
}

// fetchDataAt(moment('2017-10-16').tz("America/Los_Angeles"), 1).then(() => {
//   sequelize.close();
// });
// crawlLatest();
// crawlAllBetween(moment('2017-10-10').tz("America/Los_Angeles"), moment('2017-10-16').tz("America/Los_Angeles"));
// Employer.findAll({where: {name: '123'}});
