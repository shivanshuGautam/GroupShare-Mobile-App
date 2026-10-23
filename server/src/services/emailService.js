const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
  const pass = (process.env.EMAIL_PASS || process.env.GMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  if (user && pass) {
    const isGmail = user.toLowerCase().includes('gmail') || !process.env.EMAIL_HOST || process.env.EMAIL_HOST.includes('gmail');

    if (isGmail) {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
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
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return null;
};

// Verify transporter at startup
const testEmailConnection = async () => {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
  const transporter = createTransporter();

  if (!transporter) {
    console.log(' [EmailService] SMTP not fully configured (missing EMAIL_USER or EMAIL_PASS). Codes will be logged to server console.');
    return;
  }

  try {
    await transporter.verify();
    console.log(`[EmailService] Gmail SMTP connected successfully as: ${user}`);
  } catch (error) {
    console.warn(` [EmailService] Gmail SMTP Notice: ${error.message}`);
    console.warn('    If Gmail blocked sign-in, ensure 2-Step Verification is ON and a Google App Password is used.');
    console.warn('    Codes will always be displayed in the server terminal and returned to the app.');
  }
};

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification code
const sendVerificationEmail = async (email, code, userName) => {
  console.log('\n=============================================================');
  console.log('  EMAIL VERIFICATION CODE GENERATED');
  console.log(` Recipient: ${userName || 'User'} <${email}>`);
  console.log(`  6-Digit Code: [ ${code} ] `);
  console.log(' Expires in 15 minutes');
  console.log('=============================================================\n');

  const transporter = createTransporter();
  if (!transporter) {
    return { success: true, mode: 'console-logged', code };
  }

  try {
    const senderUser = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
    const fromAddress = process.env.EMAIL_FROM || (senderUser ? `"GroupShare App" <${senderUser}>` : '"GroupShare App" <no-reply@groupshare.local>');
    const info = await transporter.sendMail({
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
    console.log(`[EmailService] Verification email successfully sent to ${email} (MessageId: ${info.messageId})`);
    return { success: true, mode: 'sent-smtp', code };
  } catch (error) {
    console.error(` [EmailService] SMTP error sending to ${email}:`, error.message);
    console.log(`    Use the 6-digit code logged above: [ ${code} ]`);
    return { success: true, mode: 'console-logged', code };
  }
};

// Send group invitation email
const sendGroupInviteEmail = async ({
  toEmail,
  groupName,
  inviterName,
  inviteToken,
  inviteLink,
  isExistingUser = false,
  expiresAt,
}) => {
  const expiryFormatted = expiresAt ? new Date(expiresAt).toLocaleDateString() : '7 days';
  const appDeepLink = inviteToken ? `groupshare://invite/${inviteToken}` : '';
  const webLink = inviteLink || `https://groupshare-mobile-app.onrender.com/invite/${inviteToken || ''}`;

  console.log('\n=============================================');
  console.log(` GROUP INVITATION DISPATCHED`);
  console.log(` Recipient: ${toEmail}`);
  console.log(` Group: "${groupName}" invited by ${inviterName}`);
  console.log(` Mode: ${isExistingUser ? 'Existing User (Direct Member)' : 'New / Pending User'}`);
  if (inviteToken) console.log(` Invite Token: ${inviteToken}`);
  if (inviteLink) console.log(` Invite Link: ${inviteLink}`);
  console.log('=============================================\n');

  const transporter = createTransporter();
  if (!transporter) {
    return { success: true, mode: 'console-logged', inviteToken, inviteLink: webLink };
  }

  try {
    const senderUser = process.env.EMAIL_USER || process.env.GMAIL_USERNAME;
    const fromAddress =
      process.env.EMAIL_FROM ||
      (senderUser ? `"GroupShare App" <${senderUser.trim()}>` : '"GroupShare App" <no-reply@groupshare.local>');

    const subject = isExistingUser
      ? `You have been added to "${groupName}" on GroupShare`
      : `Invitation: Join "${groupName}" on GroupShare`;

    const htmlContent = isExistingUser
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; color: #1E293B; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #4F46E5; color: #FFF; font-weight: bold; font-size: 20px; padding: 12px 24px; border-radius: 8px;">
              GroupShare
            </div>
          </div>
          <h2 style="color: #0F172A; margin-top: 0; font-size: 22px;">You've Been Added to a Group!</h2>
          <p style="font-size: 15px; line-height: 1.6;">Hi there,</p>
          <p style="font-size: 15px; line-height: 1.6;">
            <strong>${inviterName}</strong> added you directly to the workspace group <strong>"${groupName}"</strong> on GroupShare.
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            You can now view, upload, and collaborate on shared documents with all group members.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="groupshare://groups" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
              Open Group in App
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 25px 0;" />
          <p style="color: #64748B; font-size: 13px; text-align: center;">
            GroupShare &bull; Secure Document Collaboration for Teams
          </p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; color: #1E293B; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #4F46E5; color: #FFF; font-weight: bold; font-size: 20px; padding: 12px 24px; border-radius: 8px;">
              GroupShare
            </div>
          </div>
          <h2 style="color: #0F172A; margin-top: 0; font-size: 22px;">You're Invited to Join "${groupName}"</h2>
          <p style="font-size: 15px; line-height: 1.6;">Hi,</p>
          <p style="font-size: 15px; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to collaborate in the workspace group <strong>"${groupName}"</strong> on GroupShare.
          </p>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Group Details</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0F172A;">${groupName}</p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748B;">Invited by: ${inviterName}</p>
          </div>
          <p style="font-size: 15px; line-height: 1.6;">
            Click the button below to open the invitation and accept in GroupShare:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${webLink}" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
              Accept Invitation & Join Group
            </a>
          </div>
          ${
            inviteToken
              ? `
          <div style="background: #EEF2FF; border-radius: 8px; padding: 12px; margin-top: 20px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #4338CA;">
              Or copy your secure invitation code into the app:
            </p>
            <p style="margin: 6px 0 0 0; font-family: monospace; font-size: 15px; font-weight: bold; color: #3730A3; letter-spacing: 1px;">
              ${inviteToken}
            </p>
          </div>
          `
              : ''
          }
          <p style="color: #64748B; font-size: 13px; margin-top: 20px;">
            &bull; This invitation expires on <strong>${expiryFormatted}</strong>.<br/>
            &bull; Please register or log in using this email address (<strong>${toEmail}</strong>) to accept this invitation.
          </p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 25px 0;" />
          <p style="color: #94A3B8; font-size: 12px; text-align: center;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      html: htmlContent,
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
  testEmailConnection,
};
