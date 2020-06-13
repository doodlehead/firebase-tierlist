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
const saveToken = response => {
  console.log('fetching new auth token from TVDB');
  axios.post('https://api.thetvdb.com/login', {
    apiKey: process.env.TVDB_API_KEY
  })
  .then(res => {
    const data = {
      value: res.data.token,
      createdAt: new Date()
    }

    db.collection('tokens')
      .doc('api-request-token')
      .set(data);

    response?.send(data);

    return data.value;

  }).catch(err => {
    console.error(err);
    response.status(500).send('Cannot get token, request to API failed');
  });
}

/**
 * TODO:
 * - use async/await for fetch
 * - helper method for date comparison
 * - better constants?
 */
exports.getToken = functions.https.onRequest(async (request, response) => {
  return cors(request, response, () => {
    const tokenRef = db.collection('tokens').doc('api-request-token');
  
    tokenRef.get().then(doc => {
      if (!doc.exists) {
        saveToken(response);
      } else {
        let data = doc.data();
  
        if (new Date().valueOf() - data.createdAt.toMillis() > EXPIRY_PERIOD) {
          saveToken(response); //update token if 12 hours have passed
        } else {
          data.createdAt = data.createdAt.toMillis()
          response.send(data);
        }
      }
      return doc;
    }).catch(err => {
      console.error(err);
      response.status(500).send('Cannot get token');
    })
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