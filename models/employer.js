'use strict';
module.exports = (sequelize, DataTypes) => {
  var Employer = sequelize.define('Employer', {
    name: {
      type: DataTypes.STRING,
      unique: true
    }
  });
  Employer.associate = models => {
    Employer.hasMany(models.Case);
  }
  return Employer;
};