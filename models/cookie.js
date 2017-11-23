'use strict';
module.exports = (sequelize, DataTypes) => {
  var Cookie = sequelize.define('Cookie', {
    content: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Cookie;
};