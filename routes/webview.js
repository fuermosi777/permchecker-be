var express = require('express');
var router = express.Router();

router.get('/about', function(req, res, next) {
  res.render('webview-about', { title: 'Express' });
});

module.exports = router;
