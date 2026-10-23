const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');

// Upload Document
exports.uploadDocument = async (req, res) => {
  let file = req.file;
  try {
    const userId = req.user.id;
    const {
      groupId,
      title,
      description,
      accessPermission,
      fileBase64,
      fileName: rawFileName,
      mimeType: rawMimeType,
    } = req.body;

    // Support Base64 JSON upload (resilient against mobile scoped storage / DocumentPicker cache issues)
    if (!file && fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      let ext = path.extname(rawFileName || '').toLowerCase();
      const mime = (rawMimeType || '').toLowerCase();

      if (!ext && mime) {
        if (mime === 'image/png') ext = '.png';
        else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
        else if (mime === 'image/webp') ext = '.webp';
        else if (mime === 'image/gif') ext = '.gif';
        else if (mime === 'application/pdf' || mime === 'application/x-pdf') ext = '.pdf';
        else if (
          mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          mime.includes('wordprocessingml')
        ) ext = '.docx';
        else if (mime === 'application/msword' || mime === 'application/vnd.ms-word') ext = '.doc';
        else if (mime === 'text/plain') ext = '.txt';
        else if (mime.startsWith('image/')) ext = '.' + mime.split('/')[1];
      }

      const cleanExt = ext || '.bin';
      const rawBase = path.basename(rawFileName || 'document', ext);
      const cleanBaseName = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
      const diskFileName = `${cleanBaseName}-${uniqueSuffix}${cleanExt}`;

      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const diskFilePath = path.join(uploadsDir, diskFileName);

      fs.writeFileSync(diskFilePath, buffer);

      file = {
        path: diskFilePath,
        filename: diskFileName,
        originalname: rawFileName || diskFileName,
        mimetype: rawMimeType || 'application/octet-stream',
        size: buffer.length,
      };
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file attached. Please select a PDF, JPEG/JPG, or DOCX document.',
      });
    }

    if (!groupId || !title || !title.trim()) {
      // Remove uploaded file if validation fails
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: 'Group ID and Document Title are required.',
      });
    }

    const isMongo = getDbStatus();

    // Verify valid MongoDB ObjectId if running on MongoDB
    if (isMongo && !mongoose.Types.ObjectId.isValid(groupId)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid Group ID format.',
      });
    }

    // Verify group and user membership
    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const myMembership = group.members.find((m) => {
      const memberUserId = m.user?._id || m.user;
      return memberUserId && memberUserId.toString() === userId.toString();
    });

    if (!myMembership) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a group member to upload documents.',
      });
    }

    // Determine uploader name
    let uploaderName = req.user.name || req.user.email?.split('@')[0] || 'User';
    if (!uploaderName || uploaderName === 'User') {
      if (isMongo) {
        const uploaderUser = await User.findById(userId);
        if (uploaderUser && uploaderUser.name) uploaderName = uploaderUser.name;
      } else {
        const uploaderUser = await memoryDb.users.findById(userId);
        if (uploaderUser && uploaderUser.name) uploaderName = uploaderUser.name;
      }
    }

    // Permission setting: if non-admin tries to set admin_only, allowed or fallback
    const permission = ['all', 'admin_only', 'members_view_only'].includes(accessPermission)
      ? accessPermission
      : 'all';

    const documentData = {
      title: title.trim(),
      description: (description || '').trim(),
      originalName: file.originalname || 'document',
      fileName: file.filename,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      group: groupId,
      uploadedBy: userId,
      uploaderName,
      accessPermission: permission,
    };

    let doc;
    if (isMongo) {
      doc = await Document.create(documentData);
    } else {
      doc = await memoryDb.documents.create(documentData);
    }

    // Create notifications for all other members of the group
    // Handled in a separate try-catch so notification failures never cause the upload to fail
    try {
      const recipients = group.members.filter((m) => {
        const memberUserId = m.user?._id || m.user;
        return memberUserId && memberUserId.toString() !== userId.toString();
      });

      for (const recipient of recipients) {
        const targetUserId = recipient.user?._id || recipient.user;
        if (!targetUserId) continue;

        const notifData = {
          user: targetUserId,
          title: 'New Group Document Uploaded',
          message: `${uploaderName} uploaded "${title.trim()}" in "${group.name}".`,
          type: 'doc_uploaded',
          group: group._id,
          groupName: group.name,
          document: doc._id,
          documentTitle: doc.title,
        };

        if (isMongo) {
          await Notification.create(notifData);
        } else {
          await memoryDb.notifications.create(notifData);
        }
      }
    } catch (notifErr) {
      console.warn('[Upload Document] Notification dispatch notice (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully! Group members have been notified.',
      document: {
        id: doc._id,
        title: doc.title,
        description: doc.description,
        originalName: doc.originalName,
        fileName: doc.fileName,
        fileUrl: `/uploads/${doc.fileName}`,
        mimeType: doc.mimeType,
        size: doc.size,
        uploaderName: doc.uploaderName,
        accessPermission: doc.accessPermission,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}
    }
    console.error('[Upload Document Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while uploading document.' });
  }
};

// Get Documents for a Group (with Permission Check)
exports.getGroupDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const isMongo = getDbStatus();

    // Check membership and role
    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();
    const myMembership = group.members.find(
      (m) => (m.user?._id || m.user).toString() === userId.toString()
    );

    if (!myMembership && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }

    const isAdmin = isCreator || (myMembership && myMembership.role === 'admin');

    // Retrieve documents (exclude isDeleted documents and documents hidden for this user)
    let docs;
    if (isMongo) {
      docs = await Document.find({
        group: groupId,
        isDeleted: { $ne: true },
        hiddenFor: { $ne: userId },
      }).sort({ createdAt: -1 });
    } else {
      docs = await memoryDb.documents.findByGroup(groupId);
      docs = docs.filter(
        (d) =>
          !d.isDeleted &&
          !(d.hiddenFor && d.hiddenFor.map(String).includes(userId.toString()))
      );
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Filter documents based on access rights
    // If not admin, hide 'admin_only' documents unless uploaded by the user
    const accessibleDocs = docs.filter((d) => {
      if (isAdmin) return true;
      if (d.uploadedBy && d.uploadedBy.toString() === userId.toString()) return true;
      return d.accessPermission !== 'admin_only';
    });

    const formattedDocs = accessibleDocs.map((d) => {
      const isUploader = d.uploadedBy && d.uploadedBy.toString() === userId.toString();
      const canDeleteForEveryone = isAdmin || isUploader;
      return {
        id: d._id,
        title: d.title,
        description: d.description,
        originalName: d.originalName,
        fileName: d.fileName,
        fileUrl: `/uploads/${d.fileName}`,
        mimeType: d.mimeType,
        size: d.size,
        uploaderName: d.uploaderName,
        uploadedBy: d.uploadedBy,
        accessPermission: d.accessPermission,
        canDelete: canDeleteForEveryone, // for backward compatibility
        canDeleteForEveryone,
        canDeleteForMe: true,
        createdAt: d.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      documents: formattedDocs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Download / View Document file
exports.downloadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const isMongo = getDbStatus();

    let doc;
    if (isMongo) {
      doc = await Document.findById(id);
    } else {
      doc = await memoryDb.documents.findById(id);
    }

    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found or has been deleted.' });
    }

    // Verify group membership & permission
    let group;
    if (isMongo) {
      group = await Group.findById(doc.group);
    } else {
      group = await memoryDb.groups.findById(doc.group);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Associated group not found.' });
    }

    const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();
    const myMembership = group.members.find(
      (m) => (m.user?._id || m.user).toString() === userId.toString()
    );

    if (!myMembership && !isCreator) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const isAdmin = isCreator || (myMembership && myMembership.role === 'admin');

    if (
      doc.accessPermission === 'admin_only' &&
      !isAdmin &&
      doc.uploadedBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'This document is restricted to group administrators.',
      });
    }

    const filePath = path.join(__dirname, '..', '..', 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Document for Me (hides the document from the current user only)
exports.deleteForMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const isMongo = getDbStatus();

    let doc;
    if (isMongo) {
      doc = await Document.findById(id);
    } else {
      doc = await memoryDb.documents.findById(id);
    }

    if (!doc || doc.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or has already been deleted.',
      });
    }

    // Verify group membership
    let group;
    if (isMongo) {
      group = await Group.findById(doc.group);
    } else {
      group = await memoryDb.groups.findById(doc.group);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Associated group not found.' });
    }

    const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();
    const myMembership = group.members.find(
      (m) => (m.user?._id || m.user).toString() === userId.toString()
    );

    if (!myMembership && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }

    // Add user to hiddenFor array (idempotent)
    if (isMongo) {
      await Document.findByIdAndUpdate(id, {
        $addToSet: { hiddenFor: userId },
      });
    } else {
      await memoryDb.documents.hideForUser(id, userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Document hidden for you successfully.',
      documentId: id,
    });
  } catch (error) {
    console.error('[Delete For Me Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Document for Everyone (Admins and Document Uploader only)
exports.deleteForEveryone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const isMongo = getDbStatus();

    let doc;
    if (isMongo) {
      doc = await Document.findById(id);
    } else {
      doc = await memoryDb.documents.findById(id);
    }

    if (!doc || doc.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or has already been deleted.',
      });
    }

    let group;
    if (isMongo) {
      group = await Group.findById(doc.group);
    } else {
      group = await memoryDb.groups.findById(doc.group);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Associated group not found.' });
    }

    const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();
    const myMembership = group.members.find(
      (m) => (m.user?._id || m.user).toString() === userId.toString()
    );

    const isAdmin = isCreator || (myMembership && myMembership.role === 'admin');
    const isUploader = doc.uploadedBy && doc.uploadedBy.toString() === userId.toString();

    if (!isAdmin && !isUploader) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only group administrators or the document uploader can delete this document for everyone.',
      });
    }

    // Delete file from disk safely only if not referenced by another active document
    let otherReferences = 0;
    if (isMongo) {
      otherReferences = await Document.countDocuments({
        fileName: doc.fileName,
        _id: { $ne: id },
        isDeleted: { $ne: true },
      });
    } else {
      otherReferences = memoryDb.rawStore.documents.filter(
        (d) => d.fileName === doc.fileName && d._id.toString() !== id.toString() && !d.isDeleted
      ).length;
    }

    if (otherReferences === 0 && doc.fileName) {
      const filePath = path.join(__dirname, '..', '..', 'uploads', doc.fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.warn('[Delete Document] Notice unlinking physical file:', fileErr.message);
        }
      }
    }

    // Update the database to reflect deleted state
    if (isMongo) {
      await Document.findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      });
    } else {
      await memoryDb.documents.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document deleted for everyone successfully.',
      documentId: id,
    });
  } catch (error) {
    console.error('[Delete For Everyone Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Backward-compatible alias
exports.deleteDocument = exports.deleteForEveryone;
