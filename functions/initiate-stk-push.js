const axios = require('axios');

// Helper function to get Daraja API access token
async function getAccessToken() {
    const consumerKey = process.env.DARAJA_CONSUMER_KEY;
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const auth = 'Basic ' + Buffer.from(consumerKey + ':' + consumerSecret).toString('base64');

    try {
        const response = await axios.get(url, { headers: { Authorization: auth } });
        return response.data.access_token;
    } catch (error) {
        throw new Error(`Failed to get access token: ${error.message}`);
    }
}

// Main serverless function handler
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { amount, phoneNumber } = JSON.parse(event.body);

        // Basic validation
        if (!amount || !phoneNumber) {
            return { statusCode: 400, body: 'Bad Request: Missing amount or phoneNumber' };
        }

        const accessToken = await getAccessToken();
        const url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const passkey = process.env.DARAJA_PASSKEY;
        const shortCode = process.env.DARAJA_BUSINESS_SHORT_CODE;
        const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');
        
        // This is the URL of our *second* function that Daraja will call.
        // Netlify provides this automatically.
        const callbackUrl = `${process.env.URL}/.netlify/functions/payment-callback`;

        const payload = {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline', // or 'CustomerBuyGoodsOnline' for Till Numbers
            Amount: amount,
            PartyA: phoneNumber, // The user's phone number
            PartyB: shortCode,   // Your Paybill or Till Number
            PhoneNumber: phoneNumber,
            CallBackURL: callbackUrl,
            AccountReference: 'KIU Booking', // A reference for the transaction
            TransactionDesc: 'Payment for KIU service booking'
        };

        const response = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        return {
            statusCode: 200,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
