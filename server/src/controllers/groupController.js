const crypto = require('crypto');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');
const { sendGroupInviteEmail } = require('../services/emailService');

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
      const myMembership = g.members.find((m) => m.user.toString() === userId.toString());
      return {
        id: g._id,
        name: g.name,
        description: g.description,
        category: g.category,
        avatar: g.avatar || '',
        myRole: myMembership ? myMembership.role : 'member',
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

    // Verify requesting user is a member
    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );

    if (!myMembership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this group.',
      });
    }

    return res.status(200).json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        avatar: group.avatar || '',
        myRole: myMembership.role,
        members: group.members.map((m) => {
          const userObj = m.user && typeof m.user === 'object' ? m.user : {};
          return {
            userId: userObj._id || m.user,
            name: userObj.name || m.email.split('@')[0],
            email: m.email,
            role: m.role,
            jobTitle: userObj.jobTitle || 'Member',
            department: userObj.department || 'General',
            joinedAt: m.joinedAt,
          };
        }),
        invites: myMembership.role === 'admin' ? group.invites : [],
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Invite a member by email (Admins only)
exports.inviteMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Member email is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isMongo = getDbStatus();

    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Permission check: only group admin can invite
    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );

    if (!myMembership || myMembership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only group administrators can invite members.',
      });
    }

    // Check if user is already a member
    const alreadyMember = group.members.some((m) => m.email.toLowerCase() === cleanEmail);
    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a member of this group.',
      });
    }

    // Check if invite already pending
    const existingInvite = group.invites.find(
      (inv) => inv.email.toLowerCase() === cleanEmail && inv.status === 'pending'
    );
    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message: 'An invitation is already pending for this email.',
      });
    }

    // Check if user exists in the app
    const targetUser = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    const inviteToken = crypto.randomBytes(16).toString('hex');

    // If existing user, add them directly or as invited member
    if (targetUser) {
      // Add directly as member
      const newMember = {
        user: targetUser._id,
        email: cleanEmail,
        role: 'member',
        joinedAt: new Date(),
      };

      if (isMongo) {
        group.members.push(newMember);
        await group.save();

        // Create notification for the invited user
        await Notification.create({
          user: targetUser._id,
          title: 'Added to Group',
          message: `You were added to the group "${group.name}".`,
          type: 'group_invite',
          group: group._id,
          groupName: group.name,
        });
      } else {
        group.members.push(newMember);
        await memoryDb.groups.update(groupId, { members: group.members });

        await memoryDb.notifications.create({
          user: targetUser._id,
          title: 'Added to Group',
          message: `You were added to the group "${group.name}".`,
          type: 'group_invite',
          group: group._id,
          groupName: group.name,
        });
      }

      await sendGroupInviteEmail({
        toEmail: cleanEmail,
        groupName: group.name,
        inviterName: req.user.email,
        inviteToken,
      });

      return res.status(200).json({
        success: true,
        message: `${cleanEmail} was added to "${group.name}" as a member!`,
        action: 'added_directly',
      });
    } else {
      // New user invite
      const inviteEntry = {
        email: cleanEmail,
        invitedBy: userId,
        token: inviteToken,
        status: 'pending',
        createdAt: new Date(),
      };

      if (isMongo) {
        group.invites.push(inviteEntry);
        await group.save();
      } else {
        group.invites.push(inviteEntry);
        await memoryDb.groups.update(groupId, { invites: group.invites });
      }

      await sendGroupInviteEmail({
        toEmail: cleanEmail,
        groupName: group.name,
        inviterName: req.user.email,
        inviteToken,
      });

      return res.status(200).json({
        success: true,
        message: `Invitation email sent to ${cleanEmail}!`,
        action: 'invite_pending',
        inviteToken,
      });
    }
  } catch (error) {
    console.error('[Invite Member Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
