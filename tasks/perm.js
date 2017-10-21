var moment = require('moment-timezone');
var axios = require('axios');
var { Employer, Case, sequelize } = require('../models');
var winston = require('winston');

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
  return `https://lcr-pjr.doleta.gov/index.cfm?event=ehLCJRExternal.dspQuickCertSearchGridData&startSearch=1&case_number=&employer_business_name=&visa_class_id=6&state_id=all&location_range=10&location_zipcode=&job_title=&naic_code=&create_date=undefined&post_end_date=undefined&h1b_data_series=ALL&start_date_from=${date.format('MM/DD/YYYY')}&start_date_to=${date.format('MM/DD/YYYY')}&end_date_from=mm/dd/yyyy&end_date_to=mm/dd/yyyy&page=${page}&rows=20&sidx=create_date&sord=desc&_search=false`;
}

/**
 * @param {object} date Moment object
 * @param {number} page
 * @return {Promise}
 */
async function fetchDataAt(date, page) {
  if (!date || !(date instanceof moment)) throw new Error('incorrect date format');
  if (page < 1 || !Number.isInteger(page)) throw new Error('incorrect page number');

  let url = getUrl(date, page);
  try {
    let result = await axios.get(url);

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

        Employer.findOrCreate({where: {name: employerName}}).spread((employer, created) => {
          Case.findOrCreate({where: {caseNumber}, defaults: {
            internalId, caseNumber, postingDate, caseType, status, employerId: employer.id, workStartDate, workEndDate, jobTitle, state, jobOrder
          }}).spread((thecase, caseCreated) => {
            if (!caseCreated) {
              winston.log('warning', 'case already exist', {caseNumber}); 
            } else {
              winston.log('info', 'case created', {caseNumber}); 
            }
          });
        });
        
      };

      let hasNextPage = data.PAGE < data.TOTAL;

      if (hasNextPage) {
        return await fetchDataAt(date, page + 1);
      } else {
        winston.log('info', 'stop fetching');
        return;
      }
    } else {
      throw new Error('data is empty');
    }
  } catch (err) {
    winston.log('error', 'perm fetch data failed', {url, err});  
  }
}

async function crawlLatest() {
  const yesterday = getYesterdayDate();
  winston.log('info', 'perm crawl latest start', {date: yesterday.format()});

  await fetchDataAt(yesterday, 1);

  process.exit();
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
    await fetchDataAt(flag, 1);
    flag.add(1, 'days');
  }

  winston.log('info', 'perm crawl within range done');

  process.exit();
}

exports.crawlLatest = crawlLatest;

// fetchDataAt(moment('2017-10-16').tz("America/Los_Angeles"), 1).then(() => {
//   sequelize.close();
// });
crawlLatest();
// crawlAllBetween(moment('2017-10-10').tz("America/Los_Angeles"), moment('2017-10-16').tz("America/Los_Angeles"));
// Employer.findAll({where: {name: '123'}});
