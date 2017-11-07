var process = require('process');

module.exports = {
  development: {
    username: "root",
    password: null,
    database: "permchecker_dev",
    host: "127.0.0.1",
    dialect: "mysql",
    logging: false
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: "127.0.0.1",
    dialect: "mysql",
    logging: false
  }
}