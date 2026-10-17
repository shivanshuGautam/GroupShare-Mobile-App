const Notification = require('../models/Notification');
const { getDbStatus } = require('../config/db');
const memoryDb = require('../services/memoryDb');

// Get all notifications for current user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const isMongo = getDbStatus();

    let notifs;
    if (isMongo) {
      notifs = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
    } else {
      notifs = await memoryDb.notifications.findForUser(userId);
      notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const unreadCount = notifs.filter((n) => !n.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications: notifs.map((n) => ({
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        groupName: n.groupName,
        documentTitle: n.documentTitle,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const isMongo = getDbStatus();

    if (isMongo) {
      await Notification.findOneAndUpdate({ _id: id, user: userId }, { isRead: true });
    } else {
      await memoryDb.notifications.markAsRead(id, userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const isMongo = getDbStatus();

    if (isMongo) {
      await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    } else {
      await memoryDb.notifications.markAllAsRead(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
