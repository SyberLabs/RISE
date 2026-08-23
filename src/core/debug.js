/**
 * Debug Logger Utility
 *
 * Provides conditional logging that can be:
 * - Enabled in development automatically
 * - Enabled in production via localStorage.setItem('RISE_DEBUG', 'true')
 * - Stripped entirely in production builds via Vite's esbuild.drop
 *
 * Usage:
 *   import { debug } from './core/debug.js';
 *   debug.log('[Component]', 'message', data);
 *   debug.warn('[Component]', 'warning');
 *   debug.error('[Component]', 'error'); // Always logs, even in production
 */

const isDev = import.meta.env?.DEV ?? false;

// Check for debug flag in localStorage (allows debugging in production)
const hasDebugFlag = () => {
  try {
    return localStorage.getItem('RISE_DEBUG') === 'true';
  } catch {
    return false;
  }
};

// Determine if logging should be active
const isDebugEnabled = () => isDev || hasDebugFlag();

/**
 * Debug logger with conditional output
 */
export const debug = {
  /**
   * Log informational messages (dev only by default)
   */
  log: (...args) => {
    if (isDebugEnabled()) {
      console.log('[RISE]', ...args);
    }
  },

  /**
   * Log warnings (dev only by default)
   */
  warn: (...args) => {
    if (isDebugEnabled()) {
      console.warn('[RISE]', ...args);
    }
  },

  /**
   * Log errors (ALWAYS logs - errors should never be silenced)
   */
  error: (...args) => {
    console.error('[RISE]', ...args);
  },

  /**
   * Log with a specific component prefix
   */
  component: (name) => ({
    log: (...args) => debug.log(`[${name}]`, ...args),
    warn: (...args) => debug.warn(`[${name}]`, ...args),
    error: (...args) => debug.error(`[${name}]`, ...args),
  }),

  /**
   * Group logs (dev only)
   */
  group: (label) => {
    if (isDebugEnabled()) {
      console.group(`[RISE] ${label}`);
    }
  },

  groupEnd: () => {
    if (isDebugEnabled()) {
      console.groupEnd();
    }
  },

  /**
   * Performance timing (dev only)
   */
  time: (label) => {
    if (isDebugEnabled()) {
      console.time(`[RISE] ${label}`);
    }
  },

  timeEnd: (label) => {
    if (isDebugEnabled()) {
      console.timeEnd(`[RISE] ${label}`);
    }
  },

  /**
   * Table output for data inspection (dev only)
   */
  table: (data) => {
    if (isDebugEnabled()) {
      console.table(data);
    }
  },

  /**
   * Enable debug mode in production
   * Call from browser console: window.RISE.enableDebug()
   */
  enable: () => {
    try {
      localStorage.setItem('RISE_DEBUG', 'true');
      console.log('[RISE] Debug mode enabled. Refresh to see logs.');
    } catch (e) {
      console.log('[RISE] Could not enable debug mode:', e);
    }
  },

  /**
   * Disable debug mode
   * Call from browser console: window.RISE.disableDebug()
   */
  disable: () => {
    try {
      localStorage.removeItem('RISE_DEBUG');
      console.log('[RISE] Debug mode disabled. Refresh to apply.');
    } catch (e) {
      console.log('[RISE] Could not disable debug mode:', e);
    }
  },

  /**
   * Check if debug is currently enabled
   */
  isEnabled: () => isDebugEnabled()
};

// Expose debug controls on window for production debugging
if (typeof window !== 'undefined') {
  window.RISE = window.RISE || {};
  window.RISE.enableDebug = debug.enable;
  window.RISE.disableDebug = debug.disable;
  window.RISE.isDebugEnabled = debug.isEnabled;
}

export default debug;
