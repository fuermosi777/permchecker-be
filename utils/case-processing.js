var moment = require('moment-timezone');
var stateMap = require('./state');

function toDay(caseNumber) {
  let parts = caseNumber.split('-');
  if (parts.length !== 3) throw new Error('Incorrect case number');

  return parts[1];
}

/**
 * @param {string} caseNumber
 * @return {object} moment object
 */
function toDate(caseNumber) {
  console.log(caseNumber);
  
  let day = toDay(caseNumber);
  let year = day.substring(0, 2);
  let dayOfYear = Number(day.substring(2)) - 1;
  let firstDayOfYear = moment.tz(`20${year}-01-01`, 'America/Los_Angeles');
  return firstDayOfYear.add(dayOfYear, 'days');
}

function shortState(state) {
  if (stateMap.hasOwnProperty(state)) {
    return stateMap[state];
  } else {
    return 'OTHER';
  }
}

module.exports = {
  toDate,
  toDay,
  shortState
};
