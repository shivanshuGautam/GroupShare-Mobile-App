const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
  const pass = (process.env.EMAIL_PASS || process.env.GMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  if (user && pass) {
    const host = (process.env.EMAIL_HOST || (user.toLowerCase().includes('smtp-brevo') ? 'smtp-relay.brevo.com' : 'smtp.gmail.com')).trim();
    const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : (host.includes('gmail') ? 465 : 587);
    const secure = port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });
  }
  return null;
};

// Send via Brevo REST API (HTTPS port 443 - 100% compliant with Render.com free tier firewall)
const sendViaBrevoApi = async ({ toEmail, subject, htmlContent }) => {
  const apiKey = (process.env.BREVO_API_KEY || process.env.EMAIL_PASS || '').trim();
  if (!apiKey) return false;

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'harigautam772@gmail.com').trim();
  const senderName = 'GroupShare App';

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.messageId) {
      console.log(`[EmailService] Brevo HTTP API successfully delivered email to ${toEmail} (MessageId: ${data.messageId})`);
      return { success: true, messageId: data.messageId };
    } else {
      console.warn('[EmailService] Brevo HTTP API notice:', data.message || response.statusText);
      return false;
    }
  } catch (err) {
    console.warn('[EmailService] Brevo HTTP API fetch notice:', err.message);
    return false;
  }
};

// Verify transporter / API at startup
const testEmailConnection = async () => {
  const apiKey = (process.env.BREVO_API_KEY || process.env.EMAIL_PASS || '').trim();
  if (apiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'accept': 'application/json', 'api-key': apiKey }
      });
      if (res.ok) {
        console.log('✅ [EmailService] Brevo HTTP API connected successfully! (Render port-443 compliant)');
        return;
      }
    } catch (_) {}
  }

  const user = (process.env.EMAIL_USER || process.env.GMAIL_USERNAME || '').trim();
  const host = (process.env.EMAIL_HOST || 'smtp').trim();
  const transporter = createTransporter();

  if (!transporter) {
    console.log('ℹ️ [EmailService] SMTP not fully configured. Codes will be logged to server console.');
    return;
  }

  try {
    await transporter.verify();
    console.log(`✅ [EmailService] SMTP connected successfully via ${host} as: ${user}`);
  } catch (error) {
    console.warn(`⚠️ [EmailService] SMTP Notice: ${error.message}`);
    console.warn('    Render.com free tier blocks SMTP ports 587/465. Brevo HTTP API will be used instead.');
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

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #4F46E5;">Welcome to GroupShare!</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Please enter the following 6-digit verification code in your mobile app to activate your account:</p>
      <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; text-align: center; margin: 20px 0;">
        ${code}
      </div>
      <p style="color: #666; font-size: 13px;">This code will expire in 15 minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  // Strategy 1: Brevo HTTP API (Port 443 - Bypasses Render SMTP port blocking)
  const brevoApiResult = await sendViaBrevoApi({
    toEmail: email,
    subject: 'Your GroupShare Email Verification Code',
    htmlContent,
  });
  if (brevoApiResult && brevoApiResult.success) {
    return { success: true, mode: 'sent-brevo-api', code };
  }

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
      html: htmlContent,
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

  // Strategy 1: Brevo HTTP API (Port 443 - Bypasses Render SMTP port blocking)
  const brevoApiResult = await sendViaBrevoApi({
    toEmail,
    subject,
    htmlContent,
  });
  if (brevoApiResult && brevoApiResult.success) {
    return { success: true, mode: 'sent-brevo-api' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: true, mode: 'console-logged', inviteToken, inviteLink: webLink };
  }

  try {
    const senderUser = process.env.EMAIL_USER || process.env.GMAIL_USERNAME;
    const fromAddress =
      process.env.EMAIL_FROM ||
      (senderUser ? `"GroupShare App" <${senderUser.trim()}>` : '"GroupShare App" <no-reply@groupshare.local>');

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      html: htmlContent,
    });
    console.log(`[EmailService] Invitation email successfully sent to ${toEmail} (MessageId: ${info.messageId})`);
    return { success: true, mode: 'sent-smtp' };
  } catch (error) {
    console.error(`[EmailService] SMTP error sending to ${toEmail}:`, error.message);
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
