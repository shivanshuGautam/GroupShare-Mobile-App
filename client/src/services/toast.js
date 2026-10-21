import Toast from 'react-native-toast-message';

/**
 * Sanitizes technical and native system error messages into clean, user-friendly text.
 * Prevents stack traces, file paths, Java exceptions, and internal errors from showing to users.
 */
export const sanitizeErrorMessage = (error, fallback = 'An unexpected error occurred. Please try again.') => {
  if (!error) return fallback;

  const rawMessage = typeof error === 'string' ? error : (error.message || '');

  if (!rawMessage || typeof rawMessage !== 'string') {
    return fallback;
  }

  const lower = rawMessage.toLowerCase();

  // Network / Connection errors
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('connection refused')
  ) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // Abort / Timeout errors
  if (lower.includes('aborterror') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'The request timed out. Please verify your server connection and try again.';
  }

  // Common HTTP status messages
  if (lower.includes('status 401') || lower.includes('unauthorized') || lower.includes('jwt expired')) {
    return 'Session expired. Please sign in again.';
  }
  if (lower.includes('status 403') || lower.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  if (lower.includes('status 404') || lower.includes('not found')) {
    return 'The requested resource could not be found.';
  }
  if (lower.includes('status 500') || lower.includes('internal server error')) {
    return 'The server encountered an error. Please try again shortly.';
  }

  // File system & Native errors (strip file paths, java stack traces)
  if (
    lower.includes('unsupported scheme') ||
    lower.includes('content://') ||
    lower.includes('file:///') ||
    lower.includes("isn't readable") ||
    lower.includes('filenotfoundexception') ||
    lower.includes('ioexception') ||
    lower.includes('illegalargumentexception')
  ) {
    return "Couldn't read the selected file. Please select a valid photo or document.";
  }

  // If message contains full path or stack trace artifacts, extract or simplify
  if (rawMessage.includes('/data/user/') || rawMessage.includes(':\\') || rawMessage.includes('at ')) {
    return 'An issue occurred while processing the file. Please try again.';
  }

  // If the message is already short and human-readable, use it cleanly
  const cleanMessage = rawMessage.replace(/^[a-zA-Z]*Error:\s*/, '').trim();

  // Cap message length so toasts remain compact and readable
  if (cleanMessage.length > 120) {
    return cleanMessage.substring(0, 117) + '...';
  }

  return cleanMessage || fallback;
};

/**
 * Global Toast service wrapper
 */
export const showToast = {
  success: (title, message = '', options = {}) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      visibilityTime: 3500,
      autoHide: true,
      ...options,
    });
  },

  error: (title, errorOrMessage = '', options = {}) => {
    // Keep developer diagnostic visible in console during dev, but never in toast
    if (__DEV__ && errorOrMessage) {
      console.log(`[Toast Error] [${title}]:`, errorOrMessage);
    }

    const friendlyMessage = sanitizeErrorMessage(errorOrMessage);

    Toast.show({
      type: 'error',
      text1: title || 'Error',
      text2: friendlyMessage,
      visibilityTime: 4000,
      autoHide: true,
      ...options,
    });
  },

  warning: (title, message = '', options = {}) => {
    Toast.show({
      type: 'warning',
      text1: title || 'Warning',
      text2: message,
      visibilityTime: 3500,
      autoHide: true,
      ...options,
    });
  },

  info: (title, message = '', options = {}) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      visibilityTime: 3500,
      autoHide: true,
      ...options,
    });
  },

  hide: () => {
    Toast.hide();
  },
};

export default showToast;
