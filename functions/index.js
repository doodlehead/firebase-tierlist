const functions = require('firebase-functions');
const dotenv = require('dotenv');
dotenv.config();
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const axios = require('axios').default;

const EXPIRY_PERIOD = 43200000; //12 hours

const saveToken = response => {
  console.log('fetching new auth token from TVDB');
  axios.post('https://api.thetvdb.com/login', {
    apiKey: process.env.TVDB_API_KEY
  })
  .then(res => {
    //console.log(res);
    const data = {
      value: res.data.token,
      createdAt: new Date()
    }

    db.collection('tokens').doc('api-request-token').set(data);
    //db.collection('tokens').add(data);
    if (response) response.send(data);

    return res;

  }).catch(err => console.error(err));
}

/**
 * TODO:
 * - use async/await for fetch
 * - helper method for date comparison
 * - better constants?
 * - send cleaner data? Format Timestamp properly (timeMillis?)
 */
exports.getToken = functions.https.onRequest(async (request, response) => {
  const tokenRef = db.collection('tokens').doc('api-request-token');
  
  tokenRef.get().then(doc => {
    if (!doc.exists) {
      saveToken(response);
    } else {
      const data = doc.data();

      if (new Date().valueOf() - data.createdAt.toMillis() > EXPIRY_PERIOD) {
        saveToken(response); //update token if 12 hours have passed
      } else {
        response.send(doc.data());
      }
    }
    return doc;
  }).catch(err => console.log(err))
})

exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
 //saveToken();
});

exports.updateToken = functions.pubsub.schedule('every 30 seconds')
  .onRun(async context => {
    console.log(context);
    saveToken();
  });