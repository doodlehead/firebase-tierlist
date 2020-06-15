const functions = require('firebase-functions');
const dotenv = require('dotenv');
dotenv.config();
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const axios = require('axios').default;
const cors = require('cors')({
  origin: true,
});

const EXPIRY_PERIOD = 43200000; //12 hours

/**
 * Fetches the token from TBDB's /login endpoint, stores it in the db,
 * and then fires the response.
 * @param {Function} response - the https response callback method
 * @returns {string} the token's value
 */
const saveToken = async response => {
  console.log('fetching new auth token from TVDB');
  const apiRes = await axios.post('https://api.thetvdb.com/login', {
    apiKey: process.env.TVDB_API_KEY
  });

  if (apiRes) {
    const data = {
      value: apiRes.data.token,
      createdAt: new Date()
    }

    db.collection('tokens')
      .doc('api-request-token')
      .set(data);

    response?.send(data);

    return data.value;
  } else {
    console.error(err);
    response?.status(500).send('Cannot get token, request to API failed');
  }
}

/**
 * Returns the auth token string.
 * TODO: memoize?
 */
const getToken = async () => {
  const tokenRef = db.collection('tokens').doc('api-request-token');
  
  const doc = await tokenRef.get();

  if (!doc.exists) {
    console.log('Token does not exist, fetching and saving.');
    return saveToken();
  } else {
    let data = doc.data();

    if (new Date().valueOf() - data.createdAt.toMillis() > EXPIRY_PERIOD) {
      console.log('Token expired, fetching and saving.');
      return saveToken(); //update token if 12 hours have passed
    } else {
      console.log('Token exists and is valid, returining value.');
      data.createdAt = data.createdAt.toMillis()
      return data.value;
    }
  }
}

/**
 * The TVDB's API doesn't support CORS, so this function will serve as a proxy
 * to call their API. Only works for GET requests for now.
 */
exports.proxy = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const token = await getToken();
      const regex = /.*proxy/;
      const urlEnd = req.originalUrl.replace(regex, '');

      const apiRes = await axios.get(`https://api.thetvdb.com${urlEnd}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      res.send(apiRes.data);
    } catch(err) {
      console.error(err);
      res.status(500).send('Could not execute proxy request');
    }
  });
});

exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

// exports.updateToken = functions.pubsub.schedule('every 30 seconds')
//   .onRun(async context => {
//     console.log(context);
//     saveToken();
//   });