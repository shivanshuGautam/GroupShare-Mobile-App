const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (authHeader) {
      token = authHeader;
    }

    // 2. Fallback to cookies if present
    if (!token && req.cookies) {
      token = req.cookies.Oreo || req.cookies.kitkat || req.cookies.token;
    }

    // 3. Fallback to query param
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'groupshare_secret_key_2026'
    );

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
    }

    const userId = decoded.id || decoded.userId || decoded._id;
    const isMongo = getDbStatus();

    let user = null;
    if (isMongo) {
      user = await User.findById(userId).select('-password');
    } else {
      user = await memoryDb.users.findById(userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User session not found or account removed.',
      });
    }

    // Attach user to req
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      jobTitle: user.jobTitle || 'Team Member',
      department: user.department || 'General',
      bio: user.bio || '',
      avatar: user.avatar || '',
      userType: user.userType || 'user',
      isVerified: user.isVerified,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      error: error.message,
    });
  }
};

const RestaurantAuthProtect = async (req, res, next) => {
  return authMiddleware(req, res, () => {
    if (req.user && req.user.userType !== 'restaurant') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. Restaurant privileges required.',
      });
    }
    next();
  });
};

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.AuthProtect = authMiddleware;
authMiddleware.OTPAuthProtect = authMiddleware;
authMiddleware.RestaurantAuthProtect = RestaurantAuthProtect;

module.exports = authMiddleware;
