const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploaderName: {
      type: String,
      default: 'Unknown',
    },
    accessPermission: {
      type: String,
      enum: ['all', 'admin_only', 'members_view_only'],
      default: 'all',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Document', DocumentSchema);
