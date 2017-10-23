var express = require('express');
var router = express.Router();
var { Case } = require('../models');
var winston = require('winston');

/* GET cases listing. */
router.get('/Cases', async function(req, res, next) {
    try {
        let cases = await Case.findAndCountAll({
            limit: 20,
            offset: 0,
        });
        res.json(cases);
    } catch (err) {
        winston.log('error', '/Cases', {err: err.message});
        res.status(500).send('Something broke!')
    }
});

module.exports = router;
