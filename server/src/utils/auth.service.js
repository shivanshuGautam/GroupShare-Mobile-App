const jwt = require('jsonwebtoken');

const genToken = (user, res) => {
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'groupshare_secret_key_2026',
    { expiresIn: '30d' }
  );

  if (res && res.cookie) {
    res.cookie('Oreo', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  return token;
};

const genOTPToken = (user, res) => {
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'groupshare_secret_key_2026',
    { expiresIn: '15m' }
  );

  if (res && res.cookie) {
    res.cookie('kitkat', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
  }

  return token;
};

module.exports = {
  genToken,
  genOTPToken,
};
