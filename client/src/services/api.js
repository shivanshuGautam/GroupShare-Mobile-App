import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

export const DEFAULT_SERVER_URL = detectedLanIp
  ? `http://${detectedLanIp}:4500`
  : Platform.OS === 'android'
  ? 'http://10.0.2.2:4500'
  : 'http://localhost:4500';

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
const apiRequest = async (path, method = 'GET', body = null, isFormData = false) => {
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
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
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
      friendlyMessage = `Could not reach backend at ${baseUrl}. Ensure backend is running on port 4500 and device IP is correct.`;
    }
    console.warn(`[API Network Notice on ${path}]:`, friendlyMessage);
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

  inviteMember: async (groupId, email) => {
    return await apiRequest(`/api/groups/${groupId}/invite`, 'POST', { email });
  },
};

// Document Sharing & Management Services
export const documentsApi = {
  getDocuments: async (groupId) => {
    return await apiRequest(`/api/documents/group/${groupId}`);
  },

  uploadDocument: async (groupId, file, title, description, accessPermission) => {
    const formData = new FormData();
    formData.append('groupId', groupId);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('accessPermission', accessPermission || 'all');
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    });

    return await apiRequest('/api/documents/upload', 'POST', formData, true);
  },

  deleteDocument: async (docId) => {
    return await apiRequest(`/api/documents/${docId}`, 'DELETE');
  },

  viewOrShareDocument: async (doc) => {
    try {
      const baseUrl = await getBaseUrl();
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const downloadUrl = `${baseUrl}/api/documents/download/${doc.id}`;
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
      console.warn('View/Share error:', e.message);
      throw e;
    }
  },
};

// Notification Services
export const notificationsApi = {
  getNotifications: async () => {
    return await apiRequest('/api/notifications');
  },

  markAsRead: async (id) => {
    return await apiRequest(`/api/notifications/${id}/read`, 'PUT');
  },

  markAllAsRead: async () => {
    return await apiRequest('/api/notifications/read/all', 'PUT');
  },
};
