var express = require('express');
var router = express.Router();
var axios = require('axios');

/* GET home page. */
router.get('/', async function(req, res, next) {
  let data = null;

  try {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    data = await axios.get(fullUrl + 'api/newapprovals');
    data = data.data;
  } catch (err) {
    console.log('shit happens: approval data not acquired', err);
  } finally {
    res.render('index', { title: 'Express', data });
  }
});

module.exports = router;
