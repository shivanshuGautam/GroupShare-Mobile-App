const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    groupCategory: {
      type: String,
      default: 'General',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviterName: {
      type: String,
      default: 'Team Member',
    },
    inviterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    status: {
      type: String,
      enum: [
        'pending_registration',
        'pending_acceptance',
        'accepted',
        'declined',
        'expired',
        'cancelled',
      ],
      default: 'pending_registration',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find active invites for a user or group
InvitationSchema.index({ group: 1, email: 1, status: 1 });
InvitationSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('Invitation', InvitationSchema);
