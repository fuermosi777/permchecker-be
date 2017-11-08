var { buildKeys } = require('../utils/build-key');
var winston = require('winston');

function checkPassport(req, res, next) {
  if (!req.headers.hasOwnProperty('passport')) {
    res.status(500).send('stop');
    return;
  }

  let pass = req.headers.passport;
  let keys = buildKeys();

  if (keys.indexOf(pass) < 0) {
    winston.log('error', 'check passport - incorrect key', {pass, keys});
    res.status(500).send('stop');
    return;
  }

  next();
}

module.exports = checkPassport;
