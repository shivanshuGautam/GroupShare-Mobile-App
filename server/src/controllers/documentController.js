const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');

// Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId, title, description, accessPermission } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file attached. Please select a PDF, JPEG/JPG, or DOCX document.',
      });
    }

    if (!groupId || !title) {
      // Remove uploaded file if validation fails
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: 'Group ID and Document Title are required.',
      });
    }

    const isMongo = getDbStatus();

    // Verify group and user membership
    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );

    if (!myMembership) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a group member to upload documents.',
      });
    }

    // Determine uploader name
    let uploaderName = req.user.email.split('@')[0];
    if (isMongo) {
      const uploaderUser = await User.findById(userId);
      if (uploaderUser) uploaderName = uploaderUser.name;
    } else {
      const uploaderUser = await memoryDb.users.findById(userId);
      if (uploaderUser) uploaderName = uploaderUser.name;
    }

    // Permission setting: if non-admin tries to set admin_only, allowed or fallback
    const permission = ['all', 'admin_only', 'members_view_only'].includes(accessPermission)
      ? accessPermission
      : 'all';

    const documentData = {
      title: title.trim(),
      description: (description || '').trim(),
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
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
    const recipients = group.members.filter(
      (m) => (m.user._id || m.user).toString() !== userId.toString()
    );

    for (const recipient of recipients) {
      const targetUserId = recipient.user._id || recipient.user;
      const notifData = {
        user: targetUserId,
        title: 'New Group Document Uploaded',
        message: `${uploaderName} uploaded "${title}" in "${group.name}".`,
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
    console.error('[Upload Document Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
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

    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );

    if (!myMembership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }

    const isAdmin = myMembership.role === 'admin';

    // Retrieve documents
    let docs;
    if (isMongo) {
      docs = await Document.find({ group: groupId }).sort({ createdAt: -1 });
    } else {
      docs = await memoryDb.documents.findByGroup(groupId);
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Filter documents based on access rights
    // If not admin, hide 'admin_only' documents
    const accessibleDocs = docs.filter((d) => {
      if (isAdmin) return true;
      if (d.uploadedBy.toString() === userId.toString()) return true;
      return d.accessPermission !== 'admin_only';
    });

    const formattedDocs = accessibleDocs.map((d) => ({
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
      canDelete: isAdmin || d.uploadedBy.toString() === userId.toString(),
      createdAt: d.createdAt,
    }));

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

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
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

    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );

    if (!myMembership) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (
      doc.accessPermission === 'admin_only' &&
      myMembership.role !== 'admin' &&
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

// Delete Document
exports.deleteDocument = async (req, res) => {
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

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    let group;
    if (isMongo) {
      group = await Group.findById(doc.group);
    } else {
      group = await memoryDb.groups.findById(doc.group);
    }

    const myMembership = group
      ? group.members.find((m) => (m.user._id || m.user).toString() === userId.toString())
      : null;

    const isAdmin = myMembership && myMembership.role === 'admin';
    const isUploader = doc.uploadedBy.toString() === userId.toString();

    if (!isAdmin && !isUploader) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only group admins or the uploader can delete this document.',
      });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', '..', 'uploads', doc.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (isMongo) {
      await Document.findByIdAndDelete(id);
    } else {
      await memoryDb.documents.delete(id);
    }

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
