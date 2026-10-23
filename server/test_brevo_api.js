const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function testBrevoApi() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    console.error('BREVO_API_KEY is not set in .env');
    return;
  }
  console.log('Testing Brevo API key from env...');

  try {
    const accRes = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'accept': 'application/json', 'api-key': apiKey }
    });
    const accData = await accRes.json();
    console.log('Account status:', accRes.status);
    console.log('Account email:', accData.email);
  } catch (err) {
    console.error('Error:', err);
  }
}

testBrevoApi();
