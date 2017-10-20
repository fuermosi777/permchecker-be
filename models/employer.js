'use strict';
module.exports = (sequelize, DataTypes) => {
  var Employer = sequelize.define('Employer', {
    name: {
      type: DataTypes.STRING,
      unique: true
    }
  }, {
    classMethods: {
      associate: function(models) {
        Employer.hasMany(models.Case, {foreignKey: 'employerId'});
      }
    }
  });
  return Employer;
};