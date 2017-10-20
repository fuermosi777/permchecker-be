'use strict';
module.exports = (sequelize, DataTypes) => {
  var Case = sequelize.define('Case', {
    internalId: {
      type: DataTypes.STRING
    },
    caseNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    postingDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    caseType: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    workStartDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    workEndDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    jobTitle: {
      type: DataTypes.STRING
    },
    state: {
      type: DataTypes.STRING
    },
    jobOrder: {
      type: DataTypes.STRING,
      allowNull: true
    },
    countryOfCitizen: {
      type: DataTypes.STRING,
      allowNull: true
    },
    employerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Employers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    }
  }, {
    classMethods: {
      associate: function(models) {
        Case.belongTo(models.Employer, {foreignKey: 'employerId'});
      }
    }
  });
  return Case;
};