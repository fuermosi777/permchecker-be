var express = require('express');
var router = express.Router();
var { Case, Employer, Cookie, Status, sequelize } = require('../models');
var winston = require('winston');
var caseProcessing = require('../utils/case-processing');
var moment = require('moment-timezone');
var checkPassport = require('../middlewares/check-passport');
var axios = require('axios');
var cheerio = require('cheerio')

const DOL_PERM_CASE_DETAIL_URL = 'https://lcr-pjr.doleta.gov/index.cfm?event=ehLCJRExternal.dspCert&doc_id=3&visa_class_id=6&id=';

const { Op } = sequelize;

function addKeywordToQuery(query, keyword) {
  query.where = {
    [Op.or]: [{
      caseNumber: {
        [Op.like]: `%${keyword}%`
      }
    }, 
    sequelize.where(sequelize.col('Employer.name'), 'LIKE', `%${keyword}%`)
  ]}
}

/* GET cases listing. */
router.get('/cases', async function(req, res, next) {
  const limit = 25;

  let { page, keyword } = req.query;

  if (!page) {
    winston.log('error', '/cases', 'param "page" is missing');
    res.status(500).send('Missing params.');
    return;
  }

  let count;
  let query = {};

  if (keyword) {
    query.include = [ { model: Employer } ];
    addKeywordToQuery(query, keyword)
  }

  try {
    count = await Case.count(query);
  } catch (err) {
    winston.log('error', '/cases', {err: err.message});
    res.status(500).send('Something broke!');
    return;
  }

  let pages = Math.ceil(count / limit);
  let offset = limit * (page - 1);

  // pages can be 0 if search keyword and get nothing
  if (pages > 0 && Number(page) > pages) {
    page = pages;
  }
  if (offset < 0) {
    offset = 0;
  }

  query = {
    limit,
    offset,
    include: [
      { model: Employer }
    ],
    order: [
      [ sequelize.literal(`${sequelize.col('internalId').col} * 1`), 'DESC' ],
      [ 'postingDate', 'DESC' ]
    ]
  };

  if (keyword) {
    addKeywordToQuery(query, keyword);
  }

  try {
    let rows = await Case.findAll(query);

    let json = {
      rows,
      pages
    };

    res.json(json);
  } catch (err) {
    winston.log('error', '/cases', {err: err.message});
    res.status(500).send('Something broke!');
    return;
  }
});

async function crawlCaseApplication(caseInternalId) {
  const url = `${DOL_PERM_CASE_DETAIL_URL}${caseInternalId}`;  

  // @ts-ignore
  const response = await axios.get(url);

  if (!response.data) {
    throw new Error(`Cannot get HTML of ${url}`);
  }

  const $ = cheerio.load(response.data);
  let json = [];

  $('.infoList').each((index, item1) => {
    let key1 = $(item1).find('.secHeader h4').text().trim();
    let val1 = [];
    $(item1).find('.infoHolder').each((index2, item2) => {
      let key2 = $(item2).find('h5').text().trim().replace(/^\d+\.\s/, '');
      let val2 = $(item2).find('p').text().trim().replace(/\n/, '').replace(/\t/, '').replace(/\s\s+/, ' ');
      if (key2 && val2) {
        val1.push({ key: key2, val: val2 });
      }
    });
    json.push({ key: key1, val: val1 });
  });
  
  return json;
}

router.get('/case/:id', async function(req, res, next) {
  try {
    let id = req.params.id;

    if (!id) throw new Error('Missing param ID');

    let c = await Case.findById(id);

    if (!c.application) {
      let crawlJson = await crawlCaseApplication(c.internalId);
      c.application = crawlJson;
      await c.save();
    }

    res.json(c);
  } catch (err) {
    winston.log('error', '/case', {err: err.message});
    res.status(500).send('Something broke!');
    return;
  }
});

/**
 * Get new approvals
 * 
 * @typedef {object} ApprovalStat
 * @property {number} total
 * @property {string} date
 * 
 * @typedef {object} NewApprovals
 * @property {string} date
 * @property {string} earliestDate
 * @property {string} latestDate
 * @property {number} total
 * @property {string} status
 * @property {ApprovalStat[]} last30Days
 * @property {ApprovalStat[]} distribution
 * @property {ApprovalStat[]} certifiedCounts
 * 
 */
router.get('/newapprovals', async function(req, res, next) {
  try {
    let latestCase = await Case.findOne({ order: [[ 'postingDate', 'DESC' ]] });

    /** @type {Date} */
    let postingDate = latestCase.postingDate;

    let last30Days = await Case.findAll({
      attributes: [
        [ sequelize.fn('DATE', sequelize.col('postingDate')), 'date'], 
        [ sequelize.fn('COUNT', '*'), 'total' ]
      ],
      group: [
        sequelize.fn('DATE', sequelize.col('postingDate'))
      ],
      order: [
        [ sequelize.fn('DATE', sequelize.col('postingDate')), 'DESC' ]
      ],
      limit: 30
    });

    last30Days.reverse();

    let latestApprovals = await Case.findAndCountAll({ where: { postingDate } });

    // Get all latest approvals and create a group by count map
    let caseNumberMap = {};
    latestApprovals.rows.forEach(ap => {
      /** @type {string} */
      let dateKey = ap.caseDate.format('YYYY-MM-DD');

      if (caseNumberMap.hasOwnProperty(dateKey)) {
        caseNumberMap[dateKey] += 1;
      } else {
        caseNumberMap[dateKey] = 1;
      }
    });

    // Convert case map to array
    /** @type {ApprovalStat[]} */
    let caseNumberList = Object.keys(caseNumberMap).map(key => ({
      total: caseNumberMap[key],
      date: key
    }));
    
    caseNumberList.sort((a, b) => moment(a.date).diff(moment(b.date)));

    // Get latest and earliest dates

    /** @type {ApprovalStat} moment */
    let earliest = caseNumberList[0];
    let latest = caseNumberList[caseNumberList.length - 1];
    
    // Create distribution

    /** @type {ApprovalStat[]} */
    let distribution = [];
    
    for (let i = 0; i < 40; i++) {
      distribution.unshift({
        total: null,
        date: moment.tz(latest.date, 'America/Los_Angeles').subtract(i, 'days').format('YYYY-MM-DD')
      });
    }

    for (let i = 0; i < distribution.length; i++) {
      
      /** @type {string} */
      let dateKey = distribution[i].date;

      if (caseNumberMap.hasOwnProperty(dateKey)) {
        distribution[i].total = caseNumberMap[dateKey];
      } else {
        distribution[i].total = 0;
      }
    }

    // Certified counts of latest 30 days
    let certifiedCounts;
    try {
      certifiedCounts = await Case.findAll({
        attributes: [
          [ sequelize.fn('COUNT', '*'), 'total' ],
          [ sequelize.fn('SUBSTRING', sequelize.col('caseNumber'), [3, 5]), 'caseNumberPartial' ]
        ],
        group: sequelize.fn('SUBSTRING', sequelize.col('caseNumber'), [3, 5]),
        order: [
          [ sequelize.fn('SUBSTRING', sequelize.col('caseNumber'), [3, 5]), 'DESC' ]
        ],
        limit: 45,
        raw: true
      });
  
      certifiedCounts.reverse();
  
      // Convert caseNumberPartial to real case date
      certifiedCounts.forEach(c => {
        c.date = caseProcessing.toDate(`A-${c.caseNumberPartial}-00000`)
      });
    } catch (err) {
      throw err;
    }

    // Get USCIS status
    let status = '';
    try {
      const latestStatus = await Status.findOne({
        order: [ [ 'createdAt', 'DESC' ]]
      });

      if (latestStatus && !latestStatus.isDone) {
        status = latestStatus.content;
      }
    } catch (err) {
      throw err;
    }

    /** @type {NewApprovals} */
    let result = {
      date: moment(postingDate).format('YYYY-MM-DD'),
      earliestDate: earliest.date,
      latestDate: latest.date,
      status,
      total: latestApprovals.count,
      last30Days,
      distribution,
      certifiedCounts
    };

    res.json(result);
  } catch (err) {
    winston.log('error', '/newapprovals', {err: err.message});
    res.status(500).send('Something broke!')
  }
});

/**
 * @typedef {object} Statistics
 * @property {number} total
 * @property {object[]} byState
 * @property {object[]} byEmployer
 * 
 * Get total certified number, top 10 by state, by company
 * @param {Date} from JS date
 * @param {Date} to JS date
 * @return {Statistics}
 */
async function getStatistics(from, to) {
  try {
    let total = await Case.count({
      where: {
        postingDate: {
          [Op.between]: [from, to]
        }
      }
    });

    let byState = await Case.findAll({
      attributes: [
        [ sequelize.col('state'), 'state' ],
        [ sequelize.fn('COUNT', '*'), 'total' ]
      ],
      group: 'state',
      order: [
        [ sequelize.fn('COUNT', '*'), 'DESC' ]
      ],
      where: {
        postingDate: {
          [Op.between]: [from, to]
        }
      },
      limit: 10
    });

    let byEmployer = await Case.findAll({
      attributes: [
        [ sequelize.col('Employer.name'), 'employer' ],
        [ sequelize.fn('COUNT', '*'), 'total' ]
      ],
      group: sequelize.col('Employer.name'),
      order: [
        [ sequelize.fn('COUNT', '*'), 'DESC' ]
      ],
      where: {
        postingDate: {
          [Op.between]: [from, to]
        }
      },
      include: [
        { model: Employer, attributes: [] }
      ],
      limit: 10
    });

    let res = { total, byState, byEmployer };

    return res;
  } catch (err) {
    throw err;
  }
}

/**
 * @param {string} range 'this-week', 'last-week', etc
 * @return {{from: Date, to: Date}}
 */
function getDateRange(range) {
  let res = {from: null, to: null};
  switch (range) {
    case 'this-week':
      res.from = moment().startOf('week').toDate();
      res.to = moment().endOf('week').toDate();
      break;
    case 'last-week':
      res.from = moment().startOf('week').subtract(7, 'days').toDate();
      res.to = moment().endOf('week').subtract(7, 'days').toDate();
      break;
    case 'this-month':
      res.from = moment().startOf('month').toDate();
      res.to = moment().endOf('month').toDate();
      break;
    case 'this-year':
      res.from = moment().startOf('year').toDate();
      res.to = moment().endOf('year').toDate();
      break;
    default:
      break;
  }
  return res;
}

/**
 * Get statistics
 */
router.get('/statistics', async function(req, res, next) {
  /** @type {string} 'this-week', 'last-week', 'this-month', 'this-year */
  let range = req.query.range;
  
  /** @type {{from: Date, to: Date}} */
  let { from, to } = getDateRange(range);

  if (from === null || to === null) {
    winston.log('error', '/statistics', {err: `incorrect date range string, got ${range}`});
    res.status(500).send('Something broke!');
    return;
  }
  
  try {
    let statistics = await getStatistics(from, to);

    res.json(statistics);
  } catch (err) {
    winston.log('error', '/statistics', {err: err.message});
    res.status(500).send('Something broke!')
  }
});

/**
 * Update cookie
 */
router.post('/cookies', async function(req, res, next) {
  let { content, internalKey } = req.body;
  if (internalKey !== process.env.PERMCHECKER_BE_INTERNAL_KEY) {
    res.status(403).send('STOP');
    return;
  }
  if (!content) {
    res.status(500).send('Missing data');
    return;
  }

  await Cookie.create({ content });
  res.send(201);
});

module.exports = router;
