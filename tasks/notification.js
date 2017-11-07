var axios = require('axios');
var winston = require('winston');

const appId = process.env.ONE_SIGNAL_APP_ID;
const apiKey = process.env.ONE_SIGNAL_REST_API_KEY;

console.log(appId, apiKey);

async function sendNotification() {
  
  try {
    //@ts-ignore
    await axios({
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
          en: '437 records processed. Earliest is Oct 5, 2015 and latest is Jul 17, 2017'
        },
        headings: {
          en: 'Daily PERM Updates'
        },
        included_segments: ['All']
      }
    });
  } catch (err) {
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
    console.log(err.config);
  }
}

sendNotification();
