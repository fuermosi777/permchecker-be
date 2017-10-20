'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Cases', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      internalId: {
        type: Sequelize.STRING
      },
      caseNumber: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      postingDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      caseType: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false
      },
      workStartDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      workEndDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      jobTitle: {
        type: Sequelize.STRING
      },
      state: {
        type: Sequelize.STRING
      },
      jobOrder: {
        type: Sequelize.STRING,
        allowNull: true
      },
      countryOfCitizen: {
        type: Sequelize.STRING,
        allowNull: true
      },
      employerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Employers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Cases');
  }
};