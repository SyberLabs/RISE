/**
 * R.I.S.E. Global Error Boundary
 * Catches and handles uncaught errors and promise rejections
 */

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: 'low',           // Minor issues, app continues normally
  MEDIUM: 'medium',     // Feature degradation, recoverable
  HIGH: 'high',         // Major feature broken
  CRITICAL: 'critical'  // App cannot continue
};

/**
 * Error categories for classification
 */
export const ErrorCategory = {
  NETWORK: 'network',
  AUDIO: 'audio',
  VISUAL: 'visual',
  STORAGE: 'storage',
  PLAYBACK: 'playback',
  NAVIGATION: 'navigation',
  UNKNOWN: 'unknown'
};

/**
 * Error report structure
 */
class ErrorReport {
  constructor(error, context = {}) {
    this.id = crypto.randomUUID();
    this.timestamp = new Date().toISOString();
    this.message = error?.message || String(error);
    this.stack = error?.stack || null;
    this.category = context.category || ErrorCategory.UNKNOWN;
    this.severity = context.severity || ErrorSeverity.MEDIUM;
    this.component = context.component || 'unknown';
    this.action = context.action || null;
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    this.url = typeof location !== 'undefined' ? location.href : null;
    this.recovered = false;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      message: this.message,
      stack: this.stack,
      category: this.category,
      severity: this.severity,
      component: this.component,
      action: this.action,
      userAgent: this.userAgent,
      url: this.url,
      recovered: this.recovered
    };
  }
}

/**
 * Global Error Boundary
 * Singleton that manages error handling across the application
 */
class ErrorBoundary {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    this.listeners = new Set();
    this.recoveryHandlers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the error boundary
   * Sets up global error handlers
   */
  init() {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return;

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
        component: 'window',
        action: 'uncaught'
      });

    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      this.handleError(error, {
        category: this.categorizeError(error),
        severity: ErrorSeverity.HIGH,
        component: 'promise',
        action: 'unhandled-rejection'
      });

    });

    this.isInitialized = true;
  }

  /**
   * Handle an error
   * @param {Error} error - The error to handle
   * @param {Object} context - Error context
   * @returns {ErrorReport} The error report
   */
  handleError(error, context = {}) {
    const report = new ErrorReport(error, context);

    // Store error (with limit)
    this.errors.push(report);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Attempt recovery
    const recovered = this.attemptRecovery(report);
    report.recovered = recovered;

    // Notify listeners
    this.notifyListeners(report);

    // Keep production failures observable in the browser console; development
    // adds the full structured context.
    if (import.meta.env?.DEV) {
      console.group(`[R.I.S.E. Error] ${report.category}/${report.severity}`);
      console.error(error);
      console.log('Context:', context);
      console.log('Report:', report.toJSON());
      console.groupEnd();
    } else {
      console.error(`[R.I.S.E.] ${report.category}/${report.severity}:`, error);
    }

    // Show user notification for high/critical errors
    if (report.severity === ErrorSeverity.HIGH || report.severity === ErrorSeverity.CRITICAL) {
      this.showUserNotification(report);
    }

    return report;
  }

  /**
   * Categorize an error based on its message/type
   * @param {Error} error
   * @returns {string} Error category
   */
  categorizeError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('fetch') || message.includes('network') || message.includes('cors')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('audio') || message.includes('audiocontext')) {
      return ErrorCategory.AUDIO;
    }
    if (message.includes('canvas') || message.includes('visual') || message.includes('webgl')) {
      return ErrorCategory.VISUAL;
    }
    if (message.includes('storage') || message.includes('quota') || message.includes('localstorage')) {
      return ErrorCategory.STORAGE;
    }
    if (message.includes('player') || message.includes('playback') || message.includes('session')) {
      return ErrorCategory.PLAYBACK;
    }
    if (message.includes('route') || message.includes('navigate') || message.includes('view')) {
      return ErrorCategory.NAVIGATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Register a recovery handler for a category
   * @param {string} category
   * @param {Function} handler
   */
  registerRecoveryHandler(category, handler) {
    this.recoveryHandlers.set(category, handler);
  }

  /**
   * Attempt to recover from an error
   * @param {ErrorReport} report
   * @returns {boolean} Whether recovery was successful
   */
  attemptRecovery(report) {
    const handler = this.recoveryHandlers.get(report.category);

    if (handler) {
      try {
        const result = handler(report);
        if (result && typeof result.then === 'function') {
          report.recovered = false;
          result.then(value => {
            report.recovered = value !== false;
            this.notifyListeners(report);
          }).catch(error => {
            report.recovered = false;
            console.error('[R.I.S.E.] Recovery failed:', error);
            this.notifyListeners(report);
          });
          return false;
        }
        return result !== false;
      } catch (e) {
        // Recovery failed, but don't throw
        return false;
      }
    }

    return false;
  }

  /**
   * Subscribe to error events
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an error
   * @param {ErrorReport} report
   */
  notifyListeners(report) {
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch (e) {
        // Don't let listener errors break the chain
      }
    }
  }

  /**
   * Show user notification for severe errors
   * @param {ErrorReport} report
   */
  showUserNotification(report) {
    // Find toast container
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.setAttribute('role', 'alert');

    const message = this.getUserFriendlyMessage(report);
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /**
   * Get user-friendly error message
   * @param {ErrorReport} report
   * @returns {string}
   */
  getUserFriendlyMessage(report) {
    switch (report.category) {
      case ErrorCategory.NETWORK:
        return 'Connection issue. Some content may be unavailable.';
      case ErrorCategory.AUDIO:
        return 'Audio system unavailable. Session will continue silently.';
      case ErrorCategory.VISUAL:
        return 'Visual effects disabled due to an error.';
      case ErrorCategory.STORAGE:
        return 'Could not save data. Your progress may not be preserved.';
      case ErrorCategory.PLAYBACK:
        return 'Playback interrupted. Please try again.';
      case ErrorCategory.NAVIGATION:
        return 'Navigation error. Returning to portal.';
      default:
        return 'An unexpected error occurred.';
    }
  }

  /**
   * Get recent errors
   * @param {number} count
   * @returns {ErrorReport[]}
   */
  getRecentErrors(count = 10) {
    return this.errors.slice(-count);
  }

  /**
   * Get errors by category
   * @param {string} category
   * @returns {ErrorReport[]}
   */
  getErrorsByCategory(category) {
    return this.errors.filter(e => e.category === category);
  }

  /**
   * Clear error history
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Export errors for debugging
   * @returns {string} JSON string of errors
   */
  exportErrors() {
    return JSON.stringify(this.errors.map(e => e.toJSON()), null, 2);
  }
}

// Export singleton instance
export const errorBoundary = new ErrorBoundary();

/**
 * Convenience wrapper for catching errors in async functions
 * @param {Function} fn - Async function to wrap
 * @param {Object} context - Error context
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorBoundary.handleError(error, context);
      throw error; // Re-throw to allow caller handling
    }
  };
}

/**
 * Convenience wrapper for catching errors in sync functions
 * @param {Function} fn - Function to wrap
 * @param {Object} context - Error context
 * @returns {Function} Wrapped function
 */
export function tryCatch(fn, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      errorBoundary.handleError(error, context);
      return null;
    }
  };
}
