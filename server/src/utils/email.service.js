const emailService = require('../services/emailService');

module.exports = {
  ...emailService,
  sendOTPEmail: emailService.sendOTPEmail,
};
