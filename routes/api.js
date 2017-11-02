var express = require('express');
var router = express.Router();
var { Case, sequelize } = require('../models');
var winston = require('winston');
var caseProcessing = require('../utils/case-processing');
var moment = require('moment');

/* GET cases listing. */
router.get('/cases', async function(req, res, next) {
  const limit = 50;

  let { page } = req.query;

  if (!page) {
    winston.log('error', '/cases', 'param "page" is missing');
    res.status(500).send('Missing params.');
    return;
  }

  if (Number(page) <= 0) {
    winston.log('error', '/cases', 'page number is too small');
    res.status(500).send('Incorrect params.');
    return;
  }

  let casesAll;

  try {
    casesAll = await Case.findAndCountAll();
  } catch (err) {
    winston.log('error', '/cases', {err: err.message});
    res.status(500).send('Something broke!');
    return;
  }

  let pages = Math.ceil(casesAll.count / limit);
  let offset = limit * (page - 1);

  if (Number(page) > pages) {
    winston.log('error', '/cases', 'page number is too large');
    res.status(500).send('Incorrect params.');
    return;
  }

  try {
    let cases = await Case.findAndCountAll({
      limit,
      offset,
      order: [
        [ 'postingDate', 'DESC' ]
      ]
    });

    cases.pages = pages;

    res.json(cases);
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
      /** @type {object} moment object */
      let caseDate = caseProcessing.toDate(ap.caseNumber);

      /** @type {string} */
      let dateKey = caseDate.format('YYYY-MM-DD');

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
