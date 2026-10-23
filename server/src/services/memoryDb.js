// In-memory demo fallback store for initial development and demo
const crypto = require('crypto');

const memoryStore = {
  users: [],
  groups: [],
  documents: [],
  notifications: [],
};

const generateId = () => crypto.randomBytes(12).toString('hex');

// Users
const users = {
  create: async (data) => {
    const user = {
      _id: generateId(),
      ...data,
      phone: data.phone || '',
      bio: data.bio || '',
      jobTitle: data.jobTitle || 'Team Member',
      department: data.department || 'General',
      avatar: data.avatar || '',
      isVerified: data.isVerified ?? false,
      verificationCode: data.verificationCode || null,
      verificationExpires: data.verificationExpires || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.push(user);
    return user;
  },
  findByEmail: async (email) => {
    if (!email) return null;
    return memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  findById: async (id) => {
    return memoryStore.users.find((u) => u._id.toString() === id.toString()) || null;
  },
  update: async (id, updates) => {
    const index = memoryStore.users.findIndex((u) => u._id.toString() === id.toString());
    if (index === -1) return null;
    memoryStore.users[index] = {
      ...memoryStore.users[index],
      ...updates,
      updatedAt: new Date(),
    };
    return memoryStore.users[index];
  },
};

// Groups
const groups = {
  create: async (data) => {
    const group = {
      _id: generateId(),
      name: data.name,
      description: data.description || '',
      category: data.category || 'General',
      avatar: data.avatar || '',
      createdBy: data.createdBy,
      members: data.members || [],
      invites: data.invites || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.groups.push(group);
    return group;
  },
  findById: async (id) => {
    return memoryStore.groups.find((g) => g._id.toString() === id.toString()) || null;
  },
  findForUser: async (userId) => {
    return memoryStore.groups.filter((g) =>
      g.members.some((m) => m.user.toString() === userId.toString())
    );
  },
  update: async (id, updates) => {
    const index = memoryStore.groups.findIndex((g) => g._id.toString() === id.toString());
    if (index === -1) return null;
    memoryStore.groups[index] = {
      ...memoryStore.groups[index],
      ...updates,
      updatedAt: new Date(),
    };
    return memoryStore.groups[index];
  },
  delete: async (id) => {
    const index = memoryStore.groups.findIndex((g) => g._id.toString() === id.toString());
    if (index === -1) return false;
    memoryStore.groups.splice(index, 1);
    return true;
  },
};

// Documents
const documents = {
  create: async (data) => {
    const doc = {
      _id: generateId(),
      title: data.title,
      description: data.description || '',
      originalName: data.originalName,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: data.size,
      group: data.group,
      uploadedBy: data.uploadedBy,
      uploaderName: data.uploaderName || 'User',
      accessPermission: data.accessPermission || 'all',
      hiddenFor: data.hiddenFor || [],
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt || null,
      deletedBy: data.deletedBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.documents.push(doc);
    return doc;
  },
  findByGroup: async (groupId) => {
    return memoryStore.documents.filter(
      (d) => d.group.toString() === groupId.toString() && !d.isDeleted
    );
  },
  findById: async (id) => {
    return memoryStore.documents.find((d) => d._id.toString() === id.toString()) || null;
  },
  update: async (id, updates) => {
    const index = memoryStore.documents.findIndex((d) => d._id.toString() === id.toString());
    if (index === -1) return null;
    memoryStore.documents[index] = {
      ...memoryStore.documents[index],
      ...updates,
      updatedAt: new Date(),
    };
    return memoryStore.documents[index];
  },
  hideForUser: async (id, userId) => {
    const doc = memoryStore.documents.find((d) => d._id.toString() === id.toString());
    if (!doc) return null;
    doc.hiddenFor = doc.hiddenFor || [];
    if (!doc.hiddenFor.map(String).includes(userId.toString())) {
      doc.hiddenFor.push(userId.toString());
    }
    return doc;
  },
  delete: async (id) => {
    const index = memoryStore.documents.findIndex((d) => d._id.toString() === id.toString());
    if (index === -1) return false;
    memoryStore.documents.splice(index, 1);
    return true;
  },
  deleteByGroup: async (groupId) => {
    memoryStore.documents = memoryStore.documents.filter(
      (d) => d.group.toString() !== groupId.toString()
    );
    return true;
  },
};

// Notifications
const notifications = {
  create: async (data) => {
    const notif = {
      _id: generateId(),
      user: data.user,
      title: data.title,
      message: data.message,
      type: data.type || 'general',
      group: data.group || null,
      groupName: data.groupName || '',
      document: data.document || null,
      documentTitle: data.documentTitle || '',
      isRead: false,
      createdAt: new Date(),
    };
    memoryStore.notifications.unshift(notif);
    return notif;
  },
  findForUser: async (userId) => {
    return memoryStore.notifications.filter((n) => n.user.toString() === userId.toString());
  },
  markAsRead: async (id, userId) => {
    const notif = memoryStore.notifications.find(
      (n) => n._id.toString() === id.toString() && n.user.toString() === userId.toString()
    );
    if (notif) {
      notif.isRead = true;
      return notif;
    }
    return null;
  },
  markAllAsRead: async (userId) => {
    memoryStore.notifications.forEach((n) => {
      if (n.user.toString() === userId.toString()) {
        n.isRead = true;
      }
    });
    return true;
  },
  deleteByGroup: async (groupId) => {
    memoryStore.notifications = memoryStore.notifications.filter(
      (n) => (n.group ? n.group.toString() !== groupId.toString() : true)
    );
    return true;
  },
};

// Invitations
const invitations = {
  create: async (data) => {
    const inv = {
      _id: generateId(),
      group: data.group,
      groupName: data.groupName || 'Group',
      groupCategory: data.groupCategory || 'General',
      invitedBy: data.invitedBy,
      inviterName: data.inviterName || 'Team Member',
      inviterEmail: data.inviterEmail || '',
      email: data.email.toLowerCase().trim(),
      tokenHash: data.tokenHash,
      role: data.role || 'member',
      status: data.status || 'pending_registration',
      expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: data.acceptedAt || null,
      acceptedBy: data.acceptedBy || null,
      resendCount: data.resendCount || 0,
      lastSentAt: data.lastSentAt || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.invitations = memoryStore.invitations || [];
    memoryStore.invitations.unshift(inv);
    return inv;
  },
  findById: async (id) => {
    memoryStore.invitations = memoryStore.invitations || [];
    return memoryStore.invitations.find((i) => i._id.toString() === id.toString()) || null;
  },
  findByTokenHash: async (tokenHash) => {
    memoryStore.invitations = memoryStore.invitations || [];
    return memoryStore.invitations.find((i) => i.tokenHash === tokenHash) || null;
  },
  findByEmail: async (email) => {
    memoryStore.invitations = memoryStore.invitations || [];
    const clean = (email || '').toLowerCase().trim();
    return memoryStore.invitations.filter((i) => i.email.toLowerCase() === clean);
  },
  findByGroup: async (groupId) => {
    memoryStore.invitations = memoryStore.invitations || [];
    return memoryStore.invitations.filter((i) => i.group.toString() === groupId.toString());
  },
  update: async (id, updates) => {
    memoryStore.invitations = memoryStore.invitations || [];
    const idx = memoryStore.invitations.findIndex((i) => i._id.toString() === id.toString());
    if (idx === -1) return null;
    memoryStore.invitations[idx] = {
      ...memoryStore.invitations[idx],
      ...updates,
      updatedAt: new Date(),
    };
    return memoryStore.invitations[idx];
  },
  delete: async (id) => {
    memoryStore.invitations = memoryStore.invitations || [];
    const idx = memoryStore.invitations.findIndex((i) => i._id.toString() === id.toString());
    if (idx === -1) return false;
    memoryStore.invitations.splice(idx, 1);
    return true;
  },
  deleteByGroup: async (groupId) => {
    memoryStore.invitations = memoryStore.invitations || [];
    memoryStore.invitations = memoryStore.invitations.filter(
      (i) => i.group.toString() !== groupId.toString()
    );
    return true;
  },
};

module.exports = {
  users,
  groups,
  documents,
  notifications,
  invitations,
  rawStore: memoryStore,
};
