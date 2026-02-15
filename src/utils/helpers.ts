/**
 * Utility functions for Project Horizon PRM
 */

/**
 * Format duration from seconds or string to readable format
 */
export const formatDuration = (value: string | number | undefined): string => {
  if (value === undefined || value === null || value === '') {
    return '0m 00s';
  }

  // If it's already a formatted string, return as-is
  if (typeof value === 'string' && (value.includes('m') || value.includes(':'))) {
    return value;
  }

  // Convert to number
  const seconds = typeof value === 'number' ? value : Number(value);

  if (isNaN(seconds)) {
    return '0m 00s';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
};

/**
 * Normalize date to ISO string
 */
export const normalizeDate = (value: string | number | undefined): string => {
  if (!value) {
    return new Date().toISOString();
  }

  // Handle Excel Serial Date (e.g. 46046.58)
  if (typeof value === 'number' && value > 40000 && value < 100000) {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString();
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

/**
 * Get initials from a name
 */
export const getInitials = (name: string): string => {
  if (!name || name.trim() === '') {
    return '?';
  }

  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

/**
 * Clean transcript text (decode URI, handle special characters)
 */
export const cleanTranscript = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  } catch (e) {
    // If decoding fails, assume it's already plain text
    return raw.trim();
  }
};

/**
 * Parse JSON safely with fallback
 */
export const parseJSON = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

/**
 * Generate unique ID
 */
export const generateId = (prefix = 'item'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone; // Return original if format doesn't match
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Get environment variable with fallback
 */
export const getEnvVar = (key: string, fallback = ''): string => {
  return import.meta.env[key] || fallback;
};
