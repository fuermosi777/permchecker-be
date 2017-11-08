var moment = require('moment-timezone');
var sha256 = require('crypto-js/sha256');

function buildKey() {
  return sha256(process.env.API_SECRET + moment().tz('utc').format('YYYY-MM-DD HH:mm')).toString();
}

function buildKeys() {
  let utc = moment().tz('utc');
  let res = [
    sha256(process.env.API_SECRET + utc.subtract(60, 'seconds').format('YYYY-MM-DD HH:mm')).toString(),
    sha256(process.env.API_SECRET + utc.format('YYYY-MM-DD HH:mm')).toString(),
    sha256(process.env.API_SECRET + utc.add(60, 'seconds').format('YYYY-MM-DD HH:mm')).toString()
  ];

  return res;
}

module.exports = {
  buildKeys,
  buildKey
}