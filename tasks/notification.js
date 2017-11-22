var axios = require('axios');
var winston = require('winston');
var moment = require('moment');
var { track, EVENT, TYPE } = require('../utils/tracker');
var { buildKey } = require('../utils/build-key');

const appId = process.env.ONE_SIGNAL_APP_ID;
const apiKey = process.env.ONE_SIGNAL_REST_API_KEY;

/**
 * @abstract
 * @param {string} method 
 * @param {string} url 
 * @param {object} data 
 */
async function callOneSignal(method, url, data = null) {
  try {
    //@ts-ignore
    let result = await axios({
      method,
      url,
      baseURL: 'https://onesignal.com/api/v1',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`
      },
      data
    });
    if (result.hasOwnProperty('data')) {
      return result.data;
    }
  } catch (err) {
    throw err;
  }
}

async function callSendNotification(data) {
  try {
    return await callOneSignal('post', '/notifications', data);
  } catch (err) {
    throw err;
  }
}

async function callGetNotifications() {
  try {
    return await callOneSignal('get', `/notifications?app_id=${appId}&limit=1`);
  } catch (err) {
    throw err;
  } 
}

async function sendNotification() {
  
  track(EVENT.NOTIFICATION_SENDING_START, TYPE.INFO);

  try {
    let passport = buildKey();

    //@ts-ignore
    let info = await axios({
      method: 'get',
      url: 'https://permcheckerapp.com/api/newapprovals',
      headers: {
        passport
      }
    });

    let { total, earliestDate, latestDate } = info.data;


    if (!total || !earliestDate || !latestDate) throw new Error('Info fetch failed');
    let notifications = await callGetNotifications();
    let notification = notifications.notifications[0];
    let lastMsgEn = notification.contents.en;

    let newMsgEn = `${total} records processed. Earliest is ${moment(earliestDate).format('MMM Do, YYYY')} and latest is ${moment(latestDate).format('MMM Do, YYYY')}.`;

    if (lastMsgEn === newMsgEn) {
      throw new Error('Data not updated. Dont send notification today.');
    }

    //@ts-ignore
    let response = await callSendNotification({
      app_id: appId,
      contents: {
        en: newMsgEn
      },
      headings: {
        en: 'Daily PERM Updates'
      },
      included_segments: process.env.NODE_ENV === 'production' ? ['All'] : ['Test Users']
    });

    track(EVENT.NOTIFICATION_SENDING_DONE, TYPE.INFO, response.data);
  } catch (err) {
    track(EVENT.NOTIFICATION_SENDING_FAILED, TYPE.ERROR, {err: err.message});
    // winston.log('error', 'make send notification api failed', {err: err.message});  
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(err.response.data);
      console.log(err.response.status);
      console.log(err.response.headers);
    } else if (err.request) {
      // The request was made but no response was received
      // `err.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(err.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error', err.message);
    }
  }
}

sendNotification();
