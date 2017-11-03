var express = require('express');
var router = express.Router();
var { Case, Employer, sequelize } = require('../models');
var winston = require('winston');
var caseProcessing = require('../utils/case-processing');
var moment = require('moment');

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

  let casesAll;
  let query = {};

  if (keyword) {
    query.include = [ { model: Employer } ];
    addKeywordToQuery(query, keyword)
  }

  try {
    casesAll = await Case.findAndCountAll(query);
  } catch (err) {
    winston.log('error', '/cases', {err: err.message});
    res.status(500).send('Something broke!');
    return;
  }

  let pages = Math.ceil(casesAll.count / limit);
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
      [ 'postingDate', 'DESC' ]
    ]
  };

  if (keyword) {
    addKeywordToQuery(query, keyword)
  }

  try {
    let rows = await Case.findAll(query);

    rows.sort((a, b) => (moment(a.date).diff(moment(b.date))));

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
 * @property {ApprovalStat[]} last30Days
 * @property {ApprovalStat[]} distribution
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
    });

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
        date: moment(latest.date).subtract(i, 'days').format('YYYY-MM-DD')
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

    /** @type {NewApprovals} */
    let result = {
      date: moment(postingDate).format('YYYY-MM-DD'),
      earliestDate: moment(earliest.date).format('YYYY-MM-DD'),
      latestDate: moment(latest.date).format('YYYY-MM-DD'),
      total: latestApprovals.count,
      last30Days,
      distribution
    };

    res.json(result);
  } catch (err) {
    winston.log('error', '/newapprovals', {err: err.message});
    res.status(500).send('Something broke!')
  }
});

module.exports = router;
