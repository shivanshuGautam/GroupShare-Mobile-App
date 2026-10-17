const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
  const pass = (process.env.EMAIL_PASS || process.env.GMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  if (user && pass) {
    // If Gmail account, service: 'gmail' automatically configures direct SSL on port 465
    if (user.toLowerCase().includes('gmail') || !process.env.EMAIL_HOST) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return null;
};

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification code
const sendVerificationEmail = async (email, code, userName) => {
  console.log('\n=============================================');
  console.log(` EMAIL VERIFICATION DISPATCHED`);
  console.log(` Recipient: ${userName || 'User'} <${email}>`);
  console.log(` 6-Digit Verification Code: ${code}`);
  console.log(` Expires in 15 minutes`);
  console.log('=============================================\n');

  const transporter = createTransporter();
  if (!transporter) {
    return { success: true, mode: 'console-logged', code };
  }

  try {
    const senderUser = process.env.EMAIL_USER || process.env.GMAIL_USERNAME;
    const fromAddress = process.env.EMAIL_FROM || (senderUser ? `"GroupShare App" <${senderUser.trim()}>` : '"GroupShare App" <no-reply@groupshare.local>');
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Your GroupShare Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4F46E5;">Welcome to GroupShare!</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>Please enter the following 6-digit verification code in your mobile app to activate your account:</p>
          <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 13px;">This code will expire in 15 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });
    return { success: true, mode: 'sent-smtp', code };
  } catch (error) {
    console.error('[EmailService] SMTP error, logged to console:', error.message);
    return { success: true, mode: 'console-logged', code };
  }
};

// Send group invitation email
const sendGroupInviteEmail = async ({ toEmail, groupName, inviterName, inviteToken }) => {
  console.log('\n=============================================');
  console.log(` GROUP INVITATION DISPATCHED`);
  console.log(` Recipient: ${toEmail}`);
  console.log(` Group: "${groupName}" invited by ${inviterName}`);
  console.log(` Invite Token: ${inviteToken}`);
  console.log('=============================================\n');

  const transporter = createTransporter();
  if (!transporter) {
    return { success: true, mode: 'console-logged', inviteToken };
  }

  try {
    const senderUser = process.env.EMAIL_USER || process.env.GMAIL_USERNAME;
    const fromAddress = process.env.EMAIL_FROM || (senderUser ? `"GroupShare App" <${senderUser.trim()}>` : '"GroupShare App" <no-reply@groupshare.local>');
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `You've been invited to join "${groupName}" on GroupShare`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4F46E5;">Group Invitation</h2>
          <p>Hi,</p>
          <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on GroupShare.</p>
          <p>Open the GroupShare mobile app or use your invite token:</p>
          <div style="background: #F3F4F6; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 16px;">
            ${inviteToken}
          </div>
        </div>
      `,
    });
    return { success: true, mode: 'sent-smtp' };
  } catch (error) {
    console.error('[EmailService] SMTP error, logged to console:', error.message);
    return { success: true, mode: 'console-logged' };
  }
};

const sendOTPEmail = async (email, otp) => {
  return sendVerificationEmail(email, otp, 'User');
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendGroupInviteEmail,
  sendOTPEmail,
};
