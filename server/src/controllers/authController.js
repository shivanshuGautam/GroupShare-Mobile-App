const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');
const {
  generateVerificationCode,
  sendVerificationEmail,
} = require('../services/emailService');

// Helper to sign JWT token
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'groupshare_secret_key_2026',
    { expiresIn: '30d' }
  );
};

// 1. Register User
exports.register = async (req, res) => {
  try {
    const {
      name,
      fullName,
      email,
      password,
      phone,
      jobTitle,
      department,
      bio,
      gender,
      dob,
      userType,
    } = req.body;

    const displayName = (name || fullName || '').trim();
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!displayName || !cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const isMongo = getDbStatus();
    const existingUser = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const userPhone = (
      phone ||
      req.body.mobileNumber ||
      req.body.phoneNumber ||
      req.body.mobile ||
      ''
    ).toString().trim();

    const userData = {
      name: displayName,
      email: cleanEmail,
      password: hashedPassword,
      phone: userPhone,
      jobTitle: (jobTitle || 'Team Member').trim(),
      department: (department || 'General').trim(),
      bio: (bio || '').trim(),
      gender: gender || '',
      dob: dob || '',
      userType: userType || 'user',
      isVerified: false,
      verificationCode,
      verificationExpires,
      avatar: '',
    };

    let newUser;
    if (isMongo) {
      newUser = await User.create(userData);
    } else {
      newUser = await memoryDb.users.create(userData);
    }

    console.log('\n-------------------------------------------------------------');
    console.log(`[AUTH]  New User Registered: ${cleanEmail}`);
    console.log(`[AUTH]  Verification Code Generated: [ ${verificationCode} ]`);
    console.log('-------------------------------------------------------------\n');

    // Send verification email asynchronously so SMTP delays never block or reset the connection
    sendVerificationEmail(cleanEmail, verificationCode, displayName).catch((err) => {
      console.error('[Verification Email Dispatch Error]:', err.message);
    });

    return res.status(201).json({
      success: true,
      message:
        'Account registered successfully! Please enter the 6-digit code sent to your email to verify.',
      email: cleanEmail,
      verificationCode,
      debugCode: verificationCode,
      code: verificationCode,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        jobTitle: newUser.jobTitle,
        department: newUser.department,
        bio: newUser.bio,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.RegisterUser = exports.register;

// 2. Verify Email (OTP)
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code, otp } = req.body;
    const verifyCode = (code || otp || '').toString().trim();
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail || !verifyCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required.',
      });
    }

    const isMongo = getDbStatus();
    const user = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    // Match the 6-digit code sent to the user's email or allow master demo code 123456
    const isCodeValid =
      (user.verificationCode && user.verificationCode.toString() === verifyCode) ||
      verifyCode === '123456';

    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please enter the code sent to your email or check server terminal.',
      });
    }

    if (user.verificationExpires && new Date() > new Date(user.verificationExpires)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    if (isMongo) {
      user.isVerified = true;
      user.verificationCode = null;
      user.verificationExpires = null;
      await user.save();
    } else {
      await memoryDb.users.update(user._id, {
        isVerified: true,
        verificationCode: null,
        verificationExpires: null,
      });
    }

    const token = signToken(user);

    const userPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      jobTitle: user.jobTitle || 'Team Member',
      department: user.department || 'General',
      bio: user.bio || '',
      avatar: user.avatar || '',
      isVerified: true,
    };

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to GroupShare.',
      token,
      user: userPayload,
      data: userPayload,
    });
  } catch (error) {
    console.error('[Verify Email Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.VerifyOtp = exports.verifyEmail;

// 3. Resend Verification Code (Send OTP)
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const isMongo = getDbStatus();
    const user = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    const newCode = generateVerificationCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (isMongo) {
      user.verificationCode = newCode;
      user.verificationExpires = expires;
      await user.save();
    } else {
      await memoryDb.users.update(user._id, {
        verificationCode: newCode,
        verificationExpires: expires,
      });
    }

    console.log('\n-------------------------------------------------------------');
    console.log(`[AUTH] 🔄 Verification Code Resend for: ${cleanEmail}`);
    console.log(`[AUTH] 🔑 New Verification Code: [ ${newCode} ]`);
    console.log('-------------------------------------------------------------\n');

    sendVerificationEmail(cleanEmail, newCode, user.name).catch((err) => {
      console.error('[Resend Email Dispatch Error]:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `A new verification code has been dispatched to ${cleanEmail}.`,
      verificationCode: newCode,
      debugCode: newCode,
      code: newCode,
    });
  } catch (error) {
    console.error('[Resend Verification Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.SendOtp = exports.resendVerification;

// 4. Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const isMongo = getDbStatus();
    const user = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Require verification before login
    if (!user.isVerified) {
      const newCode = generateVerificationCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      if (isMongo) {
        user.verificationCode = newCode;
        user.verificationExpires = expires;
        await user.save();
      } else {
        await memoryDb.users.update(user._id, {
          verificationCode: newCode,
          verificationExpires: expires,
        });
      }

      console.log('\n-------------------------------------------------------------');
      console.log(`[AUTH] ⚠️ Login Attempt for Unverified User: ${cleanEmail}`);
      console.log(`[AUTH] 🔑 Generated Fresh Verification Code: [ ${newCode} ]`);
      console.log('-------------------------------------------------------------\n');

      sendVerificationEmail(cleanEmail, newCode, user.name).catch((err) => {
        console.error('[Login Verification Email Dispatch Error]:', err.message);
      });

      return res.status(403).json({
        success: false,
        message:
          'Please verify your email before logging in. A new verification code has been dispatched to your email.',
        email: user.email,
        verificationCode: newCode,
        debugCode: newCode,
        code: newCode,
        isVerified: false,
      });
    }

    const token = signToken(user);

    const userPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      jobTitle: user.jobTitle || 'Team Member',
      department: user.department || 'General',
      bio: user.bio || '',
      avatar: user.avatar || '',
      isVerified: user.isVerified,
    };

    return res.status(200).json({
      success: true,
      message: 'Welcome back! Login successful.',
      token,
      user: userPayload,
      data: userPayload,
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.LoginUser = exports.login;

// 5. User Profile (GET)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const isMongo = getDbStatus();

    const user = isMongo
      ? await User.findById(userId).select('-password')
      : await memoryDb.users.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        jobTitle: user.jobTitle || 'Team Member',
        department: user.department || 'General',
        bio: user.bio || '',
        avatar: user.avatar || '',
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Update Profile (PUT)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, fullName, phone, bio, jobTitle, department, avatar } = req.body;
    const isMongo = getDbStatus();

    const updates = {};
    if (name || fullName) updates.name = (name || fullName).trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (jobTitle !== undefined) updates.jobTitle = jobTitle.trim();
    if (department !== undefined) updates.department = department.trim();
    if (avatar !== undefined) updates.avatar = avatar;

    let updatedUser;
    if (isMongo) {
      updatedUser = await User.findByIdAndUpdate(userId, updates, {
        new: true,
      }).select('-password');
    } else {
      updatedUser = await memoryDb.users.update(userId, updates);
    }

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        jobTitle: updatedUser.jobTitle,
        department: updatedUser.department,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        isVerified: updatedUser.isVerified,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, password } = req.body;
    const pass = newPassword || password;

    if (!pass) {
      return res.status(400).json({
        success: false,
        message: 'New password is required.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const isMongo = getDbStatus();
    const userId = req.user ? req.user.id : null;
    let user = null;

    if (userId) {
      user = isMongo
        ? await User.findById(userId)
        : await memoryDb.users.findById(userId);
    } else if (email) {
      const cleanEmail = email.toLowerCase().trim();
      user = isMongo
        ? await User.findOne({ email: cleanEmail })
        : await memoryDb.users.findByEmail(cleanEmail);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (isMongo) {
      user.password = hashedPassword;
      await user.save();
    } else {
      await memoryDb.users.update(user._id, { password: hashedPassword });
    }

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.ResetPassword = exports.resetPassword;

// 8. Logout
exports.logout = async (req, res) => {
  try {
    if (res.clearCookie) {
      res.clearCookie('Oreo', { maxAge: 0 });
      res.clearCookie('kitkat', { maxAge: 0 });
      res.clearCookie('token', { maxAge: 0 });
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.LogoutUser = exports.logout;
