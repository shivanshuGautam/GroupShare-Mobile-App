import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { readAssetAsBase64 } from '../utils/fileUtils';

// Automatically detect host computer IP when running via Metro / Expo Go on LAN
const getDevHostIp = () => {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (
        match &&
        match[1] &&
        match[1] !== 'localhost' &&
        match[1] !== '127.0.0.1' &&
        match[1] !== '10.0.2.2'
      ) {
        return match[1];
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

const detectedLanIp = getDevHostIp();

export const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (detectedLanIp
    ? `http://${detectedLanIp}:4500`
    : 'https://groupshare-mobile-app.onrender.com');

export const STORAGE_KEYS = {
  TOKEN: '@groupshare_token',
  USER: '@groupshare_user',
  SERVER_URL: '@groupshare_server_url',
};

export const getBaseUrl = async () => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
  if (saved) {
    if (saved.includes(':5000')) {
      const updated = saved.replace(':5000', ':4500');
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, updated);
      return updated;
    }
    return saved.trim();
  }
  return DEFAULT_SERVER_URL;
};

export const setBaseUrl = async (url) => {
  if (url) {
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    // Remove trailing slash
    clean = clean.replace(/\/+$/, '');
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, clean);
    return clean;
  }
};

export const testServerConnection = async (url) => {
  const target = url || (await getBaseUrl());
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${target}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        database: data.database || 'Connected',
        url: target,
        message: 'Connected successfully to GroupShare backend!',
      };
    }
    return { success: false, message: `Server replied with status ${res.status}` };
  } catch (e) {
    let msg = e.message;
    if (e.name === 'AbortError' || e.message?.includes('canceled')) {
      msg = `Timeout connecting to ${target}. Ensure server is running and device can reach this address.`;
    }
    return { success: false, message: msg };
  }
};

// Generic HTTP request helper
const apiRequest = async (path, method = 'GET', body = null, isFormData = false, customTimeoutMs = null) => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  const baseUrl = await getBaseUrl();

  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutMs = customTimeoutMs || (isFormData ? 60000 : 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  try {
    const response = await fetch(`${baseUrl}${path}`, options);
    clearTimeout(timeoutId);

    // If unauthorized, clean invalid token so app doesn't loop
    if (response.status === 401) {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    let friendlyMessage = error.message;
    if (error.name === 'AbortError' || error.message?.includes('canceled')) {
      friendlyMessage = `Request timed out connecting to backend at ${baseUrl}. Ensure backend is running on port 4500 and device IP is correct.`;
    }
    if (__DEV__) {
      console.log(`[API Network Notice on ${path}]:`, friendlyMessage);
    }
    const err = new Error(friendlyMessage);
    err.originalError = error;
    throw err;
  }
};

// Authentication & Profile Services
export const authApi = {
  register: async (userData) => {
    return await apiRequest('/api/auth/register', 'POST', userData);
  },

  verifyEmail: async (email, code) => {
    const res = await apiRequest('/api/auth/verify-email', 'POST', {
      email: (email || '').toLowerCase().trim(),
      code: (code || '').toString().trim(),
    });
    if (res.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res;
  },

  resendVerification: async (email) => {
    return await apiRequest('/api/auth/resend-verification', 'POST', {
      email: (email || '').toLowerCase().trim(),
    });
  },

  login: async (email, password) => {
    const res = await apiRequest('/api/auth/login', 'POST', {
      email: (email || '').toLowerCase().trim(),
      password,
    });
    if (res.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res;
  },

  getProfile: async () => {
    const res = await apiRequest('/api/auth/profile');
    if (res.user) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res;
  },

  updateProfile: async (profileData) => {
    const res = await apiRequest('/api/auth/profile', 'PUT', profileData);
    if (res.user) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    }
    return res;
  },

  logout: async () => {
    try {
      await apiRequest('/api/auth/logout');
    } catch (e) {
      // ignore
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  getCurrentUser: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  getToken: async () => {
    return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },
};

// Group Workspace Services
export const groupsApi = {
  getGroups: async () => {
    return await apiRequest('/api/groups');
  },

  getGroupDetails: async (groupId) => {
    return await apiRequest(`/api/groups/${groupId}`);
  },

  createGroup: async (groupData) => {
    return await apiRequest('/api/groups', 'POST', groupData);
  },

  inviteMember: async (groupId, email, role = 'member') => {
    return await apiRequest(`/api/groups/${groupId}/invite`, 'POST', { email, role });
  },

  getGroupInvitations: async (groupId) => {
    return await apiRequest(`/api/groups/${groupId}/invitations`);
  },

  resendInvitation: async (groupId, invitationId) => {
    return await apiRequest(`/api/groups/${groupId}/invitations/${invitationId}/resend`, 'POST');
  },

  cancelInvitation: async (groupId, invitationId) => {
    return await apiRequest(`/api/groups/${groupId}/invitations/${invitationId}`, 'DELETE');
  },

  deleteGroup: async (groupId) => {
    return await apiRequest(`/api/groups/${groupId}`, 'DELETE');
  },
};

// Member Invitation Services
export const invitationsApi = {
  getUserPendingInvitations: async () => {
    return await apiRequest('/api/invitations/pending');
  },

  getInvitationByToken: async (token) => {
    return await apiRequest(`/api/invitations/${token}`, 'GET', null, false);
  },

  acceptInvitation: async (invitationId) => {
    return await apiRequest(`/api/invitations/${invitationId}/accept`, 'POST');
  },

  declineInvitation: async (invitationId) => {
    return await apiRequest(`/api/invitations/${invitationId}/decline`, 'POST');
  },
};

// Document Sharing & Management Services
export const documentsApi = {
  getDocuments: async (groupId) => {
    return await apiRequest(`/api/documents/group/${groupId}`);
  },

  uploadDocument: async (groupId, file, title, description, accessPermission) => {
    let fileName = file.name || 'document';
    let mimeType = file.mimeType || '';

    if (!mimeType) {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else if (lower.endsWith('.gif')) mimeType = 'image/gif';
      else if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (lower.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (lower.endsWith('.doc')) mimeType = 'application/msword';
      else if (lower.endsWith('.txt')) mimeType = 'text/plain';
      else mimeType = 'application/octet-stream';
    }

    if (!fileName.includes('.')) {
      if (mimeType.includes('png')) fileName += '.png';
      else if (mimeType.includes('webp')) fileName += '.webp';
      else if (mimeType.includes('pdf')) fileName += '.pdf';
      else if (mimeType.includes('wordprocessingml') || mimeType.includes('docx')) fileName += '.docx';
      else if (mimeType.includes('msword')) fileName += '.doc';
      else fileName += '.jpg';
    }

    // Strategy 1: Safe Base64 upload via readAssetAsBase64
    // Completely bypasses Android Expo Go "Location isn't readable" java.io.IOException
    try {
      const assetData = await readAssetAsBase64(file);
      if (assetData && assetData.base64) {
        return await apiRequest(
          '/api/documents/upload',
          'POST',
          {
            groupId: String(groupId),
            title: String(title),
            description: String(description || ''),
            accessPermission: String(accessPermission || 'all'),
            fileBase64: assetData.base64,
            fileName,
            mimeType: assetData.mimeType || mimeType,
          },
          false,
          60000
        );
      }
    } catch (readErr) {
      if (__DEV__) {
        console.log('[uploadDocument] Base64 conversion notice, trying fallback methods:', readErr?.message);
      }
    }

    // Strategy 2: FormData with fetch (normalized URI)
    const formData = new FormData();
    formData.append('groupId', String(groupId));
    formData.append('title', String(title));
    formData.append('description', String(description || ''));
    formData.append('accessPermission', String(accessPermission || 'all'));

    const normalizedUri = Platform.OS === 'android' ? file.uri : file.uri.replace('file://', '');
    formData.append('file', {
      uri: normalizedUri,
      name: fileName,
      type: mimeType,
    });

    return await apiRequest('/api/documents/upload', 'POST', formData, true, 60000);
  },

  deleteDocument: async (docId) => {
    return await apiRequest(`/api/documents/${docId}/everyone`, 'DELETE');
  },

  deleteForMe: async (docId) => {
    return await apiRequest(`/api/documents/${docId}/me`, 'DELETE');
  },

  deleteForEveryone: async (docId) => {
    return await apiRequest(`/api/documents/${docId}/everyone`, 'DELETE');
  },

  viewOrShareDocument: async (doc) => {
    try {
      const baseUrl = await getBaseUrl();
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const downloadUrl = `${baseUrl}/api/documents/download/${doc.id}`;

      // Web platform browser download
      if (Platform.OS === 'web') {
        const response = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = doc.originalName || doc.title || 'document';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 100);
        return { success: true };
      }

      const localTarget = `${FileSystem.documentDirectory}${doc.originalName || 'file'}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localTarget, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
          return { success: true };
        }
      }
      return { success: false, message: 'Sharing not available on this device.' };
    } catch (e) {
      if (__DEV__) {
        console.log('[API View/Share error]:', e?.message);
      }
      throw e;
    }
  },
};

// Notification Services
export const notificationsApi = {
  getNotifications: async () => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      return { success: true, notifications: [], unreadCount: 0 };
    }
    return await apiRequest('/api/notifications');
  },

  markAsRead: async (id) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) return { success: false, message: 'Not authenticated' };
    return await apiRequest(`/api/notifications/${id}/read`, 'PUT');
  },

  markAllAsRead: async () => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) return { success: false, message: 'Not authenticated' };
    return await apiRequest('/api/notifications/read/all', 'PUT');
  },
};
