const admin = require('firebase-admin');

// IMPORTANT: You need to generate a service account key from Firebase
// and add it to your Netlify environment variables.
// I will guide you on this in the next step.
if (admin.apps.length === 0) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://kiu-daa05.firebaseio.com` // TODO: Replace with your actual Firebase Project ID
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const callbackData = JSON.parse(event.body);
  const stkCallback = callbackData.Body.stkCallback;
  const checkoutRequestId = stkCallback.CheckoutRequestID;

  // Log the result from Safaricom
  console.log('Received MPESA callback:', JSON.stringify(stkCallback, null, 2));

  // ResultCode 0 means success
  const paymentStatus = stkCallback.ResultCode === 0 ? 'SUCCESS' : 'FAILED';
  const resultCode = stkCallback.ResultCode;
  const resultDesc = stkCallback.ResultDesc;

  try {
    // Write the status to the Realtime Database
    // The Android app will be listening for changes at this exact path.
    const db = admin.database();
    const ref = db.ref(`payments/${checkoutRequestId}`);

    await ref.set({
      status: paymentStatus,
      resultCode: resultCode,
      resultDesc: resultDesc,
      timestamp: new Date().toISOString()
    });

    // Respond to Safaricom's server
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Callback received successfully.' })
    };

  } catch (error) {
    console.error('Error writing to Firebase:', error);
    // Respond to Safaricom's server, but log the internal error
    return {
      statusCode: 200, // Always return 200 to Safaricom, even if our internal processing fails
      body: JSON.stringify({ message: 'Callback received but failed to process internally.' })
    };
  }
};
