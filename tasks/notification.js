var axios = require('axios');
var winston = require('winston');
var moment = require('moment');
var { track, EVENT, TYPE } = require('../utils/tracker');

const appId = process.env.ONE_SIGNAL_APP_ID;
const apiKey = process.env.ONE_SIGNAL_REST_API_KEY;

async function sendNotification() {
  
  track(EVENT.NOTIFICATION_SENDING_START, TYPE.INFO);

  try {

    //@ts-ignore
    let info = await axios({
      method: 'get',
      url: 'https://permcheckerapp.com/api/newapprovals'
    });

    let { total, earliestDate, latestDate } = info.data;


    if (!total || !earliestDate || !latestDate) throw new Error('Info fetch failed');

    //@ts-ignore
    let response = await axios({
      method: 'post',
      url: '/notifications',
      baseURL: 'https://onesignal.com/api/v1',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`
      },
      data: {
        app_id: appId,
        contents: {
          en: `${total} records processed. Earliest is ${moment(earliestDate).format('MMM Do, YYYY')} and latest is ${moment(latestDate).format('MMM Do, YYYY')}.`
        },
        headings: {
          en: 'Daily PERM Updates'
        },
        included_segments: ['All']
      }
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