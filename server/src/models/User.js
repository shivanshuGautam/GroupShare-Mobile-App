const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      default: '',
    },
    dob: {
      type: String,
      default: '',
    },
    userType: {
      type: String,
      default: 'user',
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    jobTitle: {
      type: String,
      default: 'Team Member',
      trim: true,
    },
    department: {
      type: String,
      default: 'General',
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      default: null,
    },
    verificationExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', UserSchema);
