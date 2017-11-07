var Mixpanel = require('mixpanel');

var mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);

/**
 * @param {string} event
 * @param {string} type - error, warning, info
 * @param {object} data
 * @return {void}
 */
function track(event, type, data) {
  let d = Object.assign(data, {
    env: process.env.NODE_ENV
  });

  mixpanel.track(event, d);
}

const EVENT = {
  CRAWL_LATEST_PERM_STARTED: 'crawl-latest-perm-started',
  CRAWL_LATEST_PERM_DONE: 'crawl-latest-perm-done',
  CRAWL_LATEST_PERM_FAILED: 'crawl-latest-perm-failed',
  NOTIFICATION_SENDING_START: 'notification-sending-start',
  NOTIFICATION_SENDING_DONE: 'notification-sending-done',
  NOTIFICATION_SENDING_FAILED: 'notification-sending-failed'
};

const TYPE = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

module.exports = {
  track,
  EVENT,
  TYPE
};

