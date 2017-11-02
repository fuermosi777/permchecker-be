'use strict';

var caseProcessing = require('../utils/case-processing');

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
    getterMethods: {
      caseDate() {
        if (this.caseNumber) {
          return caseProcessing.toDate(this.caseNumber);
        } else {
          return null;
        }
      }
    }
  });
  Case.associate = models => {
    Case.belongsTo(models.Employer, { foreignKey: 'employerId' });
  };
  return Case;
};