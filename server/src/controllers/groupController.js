const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const Invitation = require('../models/Invitation');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');
const { sendGroupInviteEmail } = require('../services/emailService');
const invitationController = require('./invitationController');

// Create Group (creator is Admin)
exports.createGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { name, description, category, avatar } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Group name is required.',
      });
    }

    const isMongo = getDbStatus();

    const newGroupData = {
      name: name.trim(),
      description: (description || '').trim(),
      category: category || 'General',
      avatar: avatar || '',
      createdBy: userId,
      members: [
        {
          user: userId,
          email: userEmail,
          role: 'admin',
          joinedAt: new Date(),
        },
      ],
      invites: [],
    };

    let group;
    if (isMongo) {
      group = await Group.create(newGroupData);
    } else {
      group = await memoryDb.groups.create(newGroupData);
    }

    return res.status(201).json({
      success: true,
      message: 'Group created successfully! You are the Admin of this group.',
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        avatar: group.avatar || '',
        myRole: 'admin',
        memberCount: group.members.length,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error('[Create Group Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all groups the current user belongs to
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const isMongo = getDbStatus();

    let groups;
    if (isMongo) {
      groups = await Group.find({ 'members.user': userId }).sort({ updatedAt: -1 });
    } else {
      groups = await memoryDb.groups.findForUser(userId);
    }

    const formattedGroups = groups.map((g) => {
      const isCreator = g.createdBy && g.createdBy.toString() === userId.toString();
      const myMembership = g.members.find((m) => {
        const memberUserId = m.user?._id || m.user;
        return memberUserId && memberUserId.toString() === userId.toString();
      });
      const isAdmin = isCreator || (myMembership && myMembership.role === 'admin');
      return {
        id: g._id,
        name: g.name,
        description: g.description,
        category: g.category,
        avatar: g.avatar || '',
        myRole: isAdmin ? 'admin' : (myMembership ? myMembership.role : 'member'),
        memberCount: g.members.length,
        createdAt: g.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      groups: formattedGroups,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Group Details by ID
exports.getGroupDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const isMongo = getDbStatus();

    let group;
    if (isMongo) {
      group = await Group.findById(groupId).populate('members.user', 'name email jobTitle department avatar');
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Verify requesting user is a member or creator
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
    const myRole = isAdmin ? 'admin' : (myMembership?.role || 'member');

    let adminInvitations = [];
    if (isAdmin) {
      if (isMongo) {
        adminInvitations = await Invitation.find({ group: groupId }).sort({ createdAt: -1 });
      } else {
        adminInvitations = await memoryDb.invitations.findByGroup(groupId);
      }
    }

    return res.status(200).json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        avatar: group.avatar || '',
        createdBy: group.createdBy,
        myRole: myRole,
        members: group.members.map((m) => {
          const userObj = m.user && typeof m.user === 'object' ? m.user : {};
          return {
            userId: userObj._id || m.user,
            name: userObj.name || (m.email ? m.email.split('@')[0] : 'Member'),
            email: m.email,
            role: m.role,
            jobTitle: userObj.jobTitle || 'Member',
            department: userObj.department || 'General',
            joinedAt: m.joinedAt,
          };
        }),
        invites: isAdmin ? group.invites : [],
        invitations: adminInvitations,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Invite a member by email (delegated to invitationController for full token, hash & email support)
exports.inviteMember = invitationController.sendInvitation;

// Delete Group (Admin only)
exports.deleteGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required.' });
    }

    const isMongo = getDbStatus();

    if (isMongo && !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid Group ID format.' });
    }

    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Verify creator or admin permission
    const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();
    const myMembership = group.members.find((m) => {
      const memberUserId = m.user?._id || m.user;
      return memberUserId && memberUserId.toString() === userId.toString();
    });
    const isAdmin = isCreator || (myMembership && myMembership.role === 'admin');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only group administrators can delete this group.',
      });
    }

    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    // 1. Clean up group documents and persistent files
    if (isMongo) {
      const groupDocs = await Document.find({ group: groupId });
      for (const doc of groupDocs) {
        if (doc.fileName) {
          // Check if physical file is shared/referenced by other documents
          const otherReferences = await Document.countDocuments({
            fileName: doc.fileName,
            group: { $ne: groupId },
          });
          if (otherReferences === 0) {
            const filePath = path.join(uploadsDir, doc.fileName);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (fileErr) {
                console.warn('[Delete Group] Notice unlinking file:', fileErr.message);
              }
            }
          }
        }
      }
      // Remove document records from MongoDB
      await Document.deleteMany({ group: groupId });

      // 2. Clean up notifications referencing this group
      await Notification.deleteMany({ group: groupId });

      // 3. Clean up invitations referencing this group
      await Invitation.deleteMany({ group: groupId });

      // 4. Delete the group from MongoDB
      await Group.findByIdAndDelete(groupId);
    } else {
      const groupDocs = await memoryDb.documents.findByGroup(groupId);
      for (const doc of groupDocs) {
        if (doc.fileName) {
          const otherDocs = memoryDb.rawStore.documents.filter(
            (d) => d.fileName === doc.fileName && d.group.toString() !== groupId.toString()
          );
          if (otherDocs.length === 0) {
            const filePath = path.join(uploadsDir, doc.fileName);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (_) {}
            }
          }
        }
      }
      await memoryDb.documents.deleteByGroup(groupId);
      await memoryDb.notifications.deleteByGroup(groupId);
      await memoryDb.invitations.deleteByGroup(groupId);
      await memoryDb.groups.delete(groupId);
    }

    console.log(`[Group Deleted]: ID ${groupId} by Admin ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: `Group "${group.name}" and its associated data have been deleted successfully.`,
      deletedGroupId: groupId,
    });
  } catch (error) {
    console.error('[Delete Group Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while deleting group.' });
  }
};
