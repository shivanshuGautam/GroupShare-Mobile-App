const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function run() {
  console.log('====================================');
  console.log('BREVO SMTP DIAGNOSTIC TEST');
  console.log('====================================');
  console.log('Host:', process.env.EMAIL_HOST);
  console.log('Port:', process.env.EMAIL_PORT);
  console.log('User:', process.env.EMAIL_USER);
  console.log('From:', process.env.EMAIL_FROM);
  console.log('Password prefix:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.substring(0, 15) + '...' : 'MISSING');

  try {
    console.log('\n1. Verifying SMTP connection with Brevo...');
    await transporter.verify();
    console.log('✅ Brevo SMTP Connected Successfully!');

    console.log('\n2. Sending test invitation email to hg2366762@gmail.com...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"GroupShare App" <harigautam772@gmail.com>',
      to: 'hg2366762@gmail.com',
      subject: 'GroupShare Live Test Invitation',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>GroupShare Email is Working! 🎉</h2>
          <p>This is a live test email from your GroupShare server via Brevo.</p>
        </div>
      `,
    });
    console.log('✅ SUCCESS! Email delivered to Brevo queue.');
    console.log('Message ID:', info.messageId);
    console.log('Server Response:', info.response);
    console.log('\nCheck hg2366762@gmail.com inbox (and Spam folder)!');
  } catch (err) {
    console.error('\n❌ SMTP TEST ERROR:');
    console.error('Message:', err.message);
    if (err.code) console.error('Code:', err.code);
    if (err.response) console.error('Brevo Response:', err.response);
  }
}

run();
