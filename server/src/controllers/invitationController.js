const crypto = require('crypto');
const mongoose = require('mongoose');
const Invitation = require('../models/Invitation');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');
const { sendGroupInviteEmail } = require('../services/emailService');

// Helper to hash raw token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

// 1. Send Invitation (POST /api/groups/:groupId/invite)
exports.sendInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { email, role } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member email address is required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isMongo = getDbStatus();

    // Fetch Group
    let group;
    if (isMongo) {
      group = await Group.findById(groupId);
    } else {
      group = await memoryDb.groups.findById(groupId);
    }

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Permission check: only group admin can invite members
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
    const alreadyMember = group.members.some(
      (m) => m.email && m.email.toLowerCase() === cleanEmail
    );
    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a member of this group.',
      });
    }

    // Check if user is registered in the system
    const targetUser = isMongo
      ? await User.findOne({ email: cleanEmail })
      : await memoryDb.users.findByEmail(cleanEmail);

    // ==========================================
    // CASE A: User is already registered
    // ==========================================
    if (targetUser) {
      const newMember = {
        user: targetUser._id,
        email: cleanEmail,
        role: role === 'admin' ? 'admin' : 'member',
        joinedAt: new Date(),
      };

      if (isMongo) {
        group.members.push(newMember);
        await group.save();

        // Create in-app notification for the invited user
        await Notification.create({
          user: targetUser._id,
          title: 'Added to Group',
          message: `You were added to the group "${group.name}" by ${req.user.name || req.user.email}.`,
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
          message: `You were added to the group "${group.name}" by ${req.user.name || req.user.email}.`,
          type: 'group_invite',
          group: group._id,
          groupName: group.name,
        });
      }

      // Send confirmation email
      sendGroupInviteEmail({
        toEmail: cleanEmail,
        groupName: group.name,
        inviterName: req.user.name || req.user.email,
        isExistingUser: true,
      }).catch((e) => console.warn('[Invite Email Notice]:', e.message));

      return res.status(200).json({
        success: true,
        action: 'added_directly',
        message: 'Friend added to the group successfully.',
        member: {
          userId: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: newMember.role,
          jobTitle: targetUser.jobTitle || 'Member',
          department: targetUser.department || 'General',
          joinedAt: newMember.joinedAt,
        },
      });
    }

    // ==========================================
    // CASE B: User is NOT registered
    // ==========================================
    // Check for an existing active invitation for this group and email
    let existingInvite;
    if (isMongo) {
      existingInvite = await Invitation.findOne({
        group: groupId,
        email: cleanEmail,
        status: { $in: ['pending_registration', 'pending_acceptance'] },
        expiresAt: { $gt: new Date() },
      });
    } else {
      const allInvites = await memoryDb.invitations.findByGroup(groupId);
      existingInvite = allInvites.find(
        (i) =>
          i.email.toLowerCase() === cleanEmail &&
          ['pending_registration', 'pending_acceptance'].includes(i.status) &&
          new Date(i.expiresAt) > new Date()
      );
    }

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message:
          'An active invitation is already pending for this email. You can resend it from the pending invitations list.',
      });
    }

    // Generate high-entropy secure token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitationData = {
      group: group._id,
      groupName: group.name,
      groupCategory: group.category || 'General',
      invitedBy: userId,
      inviterName: req.user.name || 'Team Admin',
      inviterEmail: req.user.email,
      email: cleanEmail,
      tokenHash,
      role: role === 'admin' ? 'admin' : 'member',
      status: 'pending_registration',
      expiresAt,
      resendCount: 0,
      lastSentAt: new Date(),
    };

    let createdInvitation;
    if (isMongo) {
      createdInvitation = await Invitation.create(invitationData);

      // Keep group.invites array in sync for backward compatibility
      group.invites = group.invites || [];
      group.invites.push({
        email: cleanEmail,
        invitedBy: userId,
        token: rawToken,
        status: 'pending',
        createdAt: new Date(),
      });
      await group.save();
    } else {
      createdInvitation = await memoryDb.invitations.create(invitationData);

      group.invites = group.invites || [];
      group.invites.push({
        email: cleanEmail,
        invitedBy: userId,
        token: rawToken,
        status: 'pending',
        createdAt: new Date(),
      });
      await memoryDb.groups.update(groupId, { invites: group.invites });
    }

    // Dispatch invitation email with deep link and web accept link
    const webInviteLink = `https://groupshare-mobile-app.onrender.com/invite/${rawToken}`;
    sendGroupInviteEmail({
      toEmail: cleanEmail,
      groupName: group.name,
      inviterName: req.user.name || req.user.email,
      inviteToken: rawToken,
      inviteLink: webInviteLink,
      isExistingUser: false,
      expiresAt,
    }).catch((e) => console.warn('[Invite Email Notice]:', e.message));

    return res.status(201).json({
      success: true,
      action: 'invite_pending',
      message: 'Invitation email sent successfully!',
      invitation: {
        id: createdInvitation._id,
        email: createdInvitation.email,
        groupName: createdInvitation.groupName,
        status: createdInvitation.status,
        expiresAt: createdInvitation.expiresAt,
        createdAt: createdInvitation.createdAt,
      },
      inviteToken: rawToken, // Provided for testing and manual entry
    });
  } catch (error) {
    console.error('[Send Invitation Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Group Invitations (GET /api/groups/:groupId/invitations)
exports.getGroupInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
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

    // Verify requester is group admin
    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );
    if (!myMembership || myMembership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only group administrators can view pending invitations.',
      });
    }

    let rawInvitations;
    if (isMongo) {
      rawInvitations = await Invitation.find({ group: groupId }).sort({ createdAt: -1 });
    } else {
      rawInvitations = await memoryDb.invitations.findByGroup(groupId);
    }

    const now = new Date();
    const invitations = [];

    for (const inv of rawInvitations) {
      let currentStatus = inv.status;
      // Mark as expired if expired and still pending
      if (
        now > new Date(inv.expiresAt) &&
        ['pending_registration', 'pending_acceptance'].includes(currentStatus)
      ) {
        currentStatus = 'expired';
        if (isMongo) {
          inv.status = 'expired';
          await inv.save();
        } else {
          await memoryDb.invitations.update(inv._id, { status: 'expired' });
        }
      }

      invitations.push({
        id: inv._id,
        email: inv.email,
        groupName: inv.groupName,
        role: inv.role || 'member',
        status: currentStatus,
        expiresAt: inv.expiresAt,
        resendCount: inv.resendCount || 0,
        lastSentAt: inv.lastSentAt || inv.createdAt,
        createdAt: inv.createdAt,
        inviterName: inv.inviterName,
      });
    }

    return res.status(200).json({
      success: true,
      invitations,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Authenticated User's Pending Invitations (GET /api/invitations/pending)
exports.getUserPendingInvitations = async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase().trim();
    const isMongo = getDbStatus();
    const now = new Date();

    let rawInvitations;
    if (isMongo) {
      rawInvitations = await Invitation.find({
        email: userEmail,
        status: { $in: ['pending_registration', 'pending_acceptance'] },
      }).sort({ createdAt: -1 });
    } else {
      const allForEmail = await memoryDb.invitations.findByEmail(userEmail);
      rawInvitations = allForEmail.filter((i) =>
        ['pending_registration', 'pending_acceptance'].includes(i.status)
      );
    }

    const pending = [];
    for (const inv of rawInvitations) {
      // Check expiration
      if (now > new Date(inv.expiresAt)) {
        if (isMongo) {
          inv.status = 'expired';
          await inv.save();
        } else {
          await memoryDb.invitations.update(inv._id, { status: 'expired' });
        }
        continue;
      }

      // If status was pending_registration, transition to pending_acceptance
      // because user is now registered and authenticated
      if (inv.status === 'pending_registration') {
        if (isMongo) {
          inv.status = 'pending_acceptance';
          await inv.save();
        } else {
          await memoryDb.invitations.update(inv._id, { status: 'pending_acceptance' });
        }
      }

      pending.push({
        id: inv._id,
        groupId: inv.group,
        groupName: inv.groupName,
        groupCategory: inv.groupCategory || 'General',
        inviterName: inv.inviterName,
        email: inv.email,
        role: inv.role || 'member',
        status: 'pending_acceptance',
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      });
    }

    return res.status(200).json({
      success: true,
      invitations: pending,
      count: pending.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Invitation Details by Token (GET /api/invitations/:token)
exports.getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Invitation token is required.' });
    }

    const tokenHash = hashToken(token);
    const isMongo = getDbStatus();

    let inv;
    if (isMongo) {
      inv = await Invitation.findOne({ tokenHash });
    } else {
      inv = await memoryDb.invitations.findByTokenHash(tokenHash);
    }

    if (!inv) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or non-existent invitation token.',
      });
    }

    const now = new Date();
    const isExpired = now > new Date(inv.expiresAt);

    if (isExpired && ['pending_registration', 'pending_acceptance'].includes(inv.status)) {
      if (isMongo) {
        inv.status = 'expired';
        await inv.save();
      } else {
        await memoryDb.invitations.update(inv._id, { status: 'expired' });
      }
    }

    return res.status(200).json({
      success: true,
      invitation: {
        id: inv._id,
        groupId: inv.group,
        groupName: inv.groupName,
        groupCategory: inv.groupCategory || 'General',
        inviterName: inv.inviterName,
        email: inv.email,
        role: inv.role || 'member',
        status: isExpired ? 'expired' : inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        isExpired,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Accept Invitation (POST /api/invitations/:invitationId/accept)
exports.acceptInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email.toLowerCase().trim();
    const { invitationId } = req.params;
    const isMongo = getDbStatus();

    let inv;
    if (isMongo) {
      inv = await Invitation.findById(invitationId);
    } else {
      inv = await memoryDb.invitations.findById(invitationId);
    }

    if (!inv) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found.',
      });
    }

    // SECURITY CHECK 1: Must match invited email exactly
    if (inv.email.toLowerCase().trim() !== userEmail) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are logged in as ${userEmail}, but this invitation was sent to ${inv.email}. Please switch accounts to accept.`,
      });
    }

    // SECURITY CHECK 2: Cannot accept cancelled invitation
    if (inv.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invitation was cancelled by the group administrator.',
      });
    }

    // SECURITY CHECK 3: Cannot accept already accepted invitation
    if (inv.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been accepted.',
      });
    }

    // SECURITY CHECK 4: Cannot accept expired invitation
    const now = new Date();
    if (now > new Date(inv.expiresAt)) {
      if (isMongo) {
        inv.status = 'expired';
        await inv.save();
      } else {
        await memoryDb.invitations.update(inv._id, { status: 'expired' });
      }
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired. Please request a new invitation.',
      });
    }

    // Fetch Target Group
    let group;
    if (isMongo) {
      group = await Group.findById(inv.group);
    } else {
      group = await memoryDb.groups.findById(inv.group);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'The group associated with this invitation no longer exists.',
      });
    }

    // Add member if not already added (prevent duplicates)
    const isAlreadyMember = group.members.some(
      (m) =>
        (m.user._id || m.user).toString() === userId.toString() ||
        (m.email && m.email.toLowerCase() === userEmail)
    );

    if (!isAlreadyMember) {
      const newMember = {
        user: userId,
        email: userEmail,
        role: inv.role || 'member',
        joinedAt: new Date(),
      };

      if (isMongo) {
        group.members.push(newMember);
        await group.save();
      } else {
        group.members.push(newMember);
        await memoryDb.groups.update(group._id, { members: group.members });
      }
    }

    // Mark invitation as accepted
    if (isMongo) {
      inv.status = 'accepted';
      inv.acceptedAt = new Date();
      inv.acceptedBy = userId;
      await inv.save();

      // Notify the inviter that the friend accepted
      await Notification.create({
        user: inv.invitedBy,
        title: 'Invitation Accepted',
        message: `${req.user.name || userEmail} accepted your invitation to join "${group.name}".`,
        type: 'general',
        group: group._id,
        groupName: group.name,
      });
    } else {
      await memoryDb.invitations.update(inv._id, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: userId,
      });

      await memoryDb.notifications.create({
        user: inv.invitedBy,
        title: 'Invitation Accepted',
        message: `${req.user.name || userEmail} accepted your invitation to join "${group.name}".`,
        type: 'general',
        group: group._id,
        groupName: group.name,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Congratulations! You have joined "${group.name}".`,
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        myRole: inv.role || 'member',
        memberCount: group.members.length,
      },
    });
  } catch (error) {
    console.error('[Accept Invitation Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Decline Invitation (POST /api/invitations/:invitationId/decline)
exports.declineInvitation = async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase().trim();
    const { invitationId } = req.params;
    const isMongo = getDbStatus();

    let inv;
    if (isMongo) {
      inv = await Invitation.findById(invitationId);
    } else {
      inv = await memoryDb.invitations.findById(invitationId);
    }

    if (!inv) {
      return res.status(404).json({ success: false, message: 'Invitation not found.' });
    }

    if (inv.email.toLowerCase().trim() !== userEmail) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only decline invitations addressed to your email.',
      });
    }

    if (isMongo) {
      inv.status = 'declined';
      await inv.save();
    } else {
      await memoryDb.invitations.update(inv._id, { status: 'declined' });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation declined.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Resend Invitation (POST /api/groups/:groupId/invitations/:invitationId/resend)
exports.resendInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId, invitationId } = req.params;
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

    // Verify admin
    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );
    if (!myMembership || myMembership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only administrators can resend invitations.',
      });
    }

    let inv;
    if (isMongo) {
      inv = await Invitation.findById(invitationId);
    } else {
      inv = await memoryDb.invitations.findById(invitationId);
    }

    if (!inv || inv.group.toString() !== groupId.toString()) {
      return res.status(404).json({ success: false, message: 'Invitation not found for this group.' });
    }

    if (inv.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been accepted.',
      });
    }

    // Rate-limit check: at least 30 seconds between resends
    const now = new Date();
    const lastSent = new Date(inv.lastSentAt || inv.createdAt);
    if (now - lastSent < 30 * 1000) {
      const waitSeconds = Math.ceil((30 * 1000 - (now - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before resending another invitation.`,
      });
    }

    // Generate new raw token and update hash (invalidating prior token)
    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updates = {
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      status: 'pending_registration',
      resendCount: (inv.resendCount || 0) + 1,
      lastSentAt: now,
    };

    if (isMongo) {
      Object.assign(inv, updates);
      await inv.save();
    } else {
      await memoryDb.invitations.update(inv._id, updates);
    }

    const webInviteLink = `https://groupshare-mobile-app.onrender.com/invite/${newRawToken}`;
    sendGroupInviteEmail({
      toEmail: inv.email,
      groupName: group.name,
      inviterName: req.user.name || req.user.email,
      inviteToken: newRawToken,
      inviteLink: webInviteLink,
      isExistingUser: false,
      expiresAt: newExpiresAt,
    }).catch((e) => console.warn('[Resend Email Notice]:', e.message));

    return res.status(200).json({
      success: true,
      message: `Invitation resent to ${inv.email}!`,
      invitation: {
        id: inv._id,
        email: inv.email,
        status: updates.status,
        expiresAt: updates.expiresAt,
        resendCount: updates.resendCount,
      },
      inviteToken: newRawToken,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Cancel Invitation (DELETE /api/groups/:groupId/invitations/:invitationId)
exports.cancelInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId, invitationId } = req.params;
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

    // Verify admin
    const myMembership = group.members.find(
      (m) => (m.user._id || m.user).toString() === userId.toString()
    );
    if (!myMembership || myMembership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only administrators can cancel invitations.',
      });
    }

    let inv;
    if (isMongo) {
      inv = await Invitation.findById(invitationId);
    } else {
      inv = await memoryDb.invitations.findById(invitationId);
    }

    if (!inv || inv.group.toString() !== groupId.toString()) {
      return res.status(404).json({ success: false, message: 'Invitation not found for this group.' });
    }

    if (inv.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an invitation that has already been accepted.',
      });
    }

    if (isMongo) {
      inv.status = 'cancelled';
      await inv.save();
    } else {
      await memoryDb.invitations.update(inv._id, { status: 'cancelled' });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
