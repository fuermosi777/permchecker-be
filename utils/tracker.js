var Mixpanel = require('mixpanel');

var mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);

/**
 * @param {string} event
 * @param {string} type - error, warning, info
 * @param {object} data
 * @return {void}
 */
function track(event, type, data = {}) {
  let d = Object.assign(data, {
    env: process.env.NODE_ENV
  });

  mixpanel.track(event, d);
}

function trackTest() {
  mixpanel.track('test');
}

const EVENT = {
  CRAWL_PERM_STARTED: 'crawl-perm-started',
  CRAWL_PERM_DONE: 'crawl-perm-done',
  CRAWL_PERM_FAILED: 'crawl-perm-failed',
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
  trackTest,
  EVENT,
  TYPE
};

