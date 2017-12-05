'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'Cases',
      'application', {
        type: Sequelize.JSON,
        allowNull: true
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn(
      'Cases',
      'application'
    );
  }
};
