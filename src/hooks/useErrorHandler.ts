import { useCallback } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Custom application error class
 * Extends Error with additional context and severity levels
 * Provides structured error logging and serialization
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly context: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly timestamp: string;
  public readonly userId?: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;

  /**
   * Create a new AppError instance
   *
   * @param message Error message
   * @param code Error code for categorization
   * @param context Where the error occurred
   * @param severity Error severity level
   * @param userId Optional user ID for error tracking
   * @param statusCode Optional HTTP status code
   * @param originalError Original error object
   *
   * @example
   * throw new AppError(
   *   'Failed to load user data',
   *   'LOAD_USER_ERROR',
   *   'UserProfile',
   *   'high',
   *   'user_123',
   *   500
   * );
   */
  constructor(
    message: string,
    code: string,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string,
    statusCode?: number,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.userId = userId;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Set prototype explicitly for instanceof checks in TypeScript
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Serialize error to JSON for logging/transmission
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      severity: this.severity,
      timestamp: this.timestamp,
      userId: this.userId,
      statusCode: this.statusCode,
      stack: this.stack,
      originalError: this.originalError instanceof Error ? this.originalError.message : String(this.originalError),
    };
  }

  /**
   * Get formatted error message for logging
   */
  toString(): string {
    return `[${this.code}] ${this.message} (${this.context})`;
  }
}

/**
 * Context information for error handling
 */
interface ErrorContext {
  context: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  extra?: Record<string, unknown>;
  statusCode?: number;
}

/**
 * Error handler hook for centralized error management
 *
 * Features:
 * - Structured error logging
 * - Analytics integration
 * - Environment-aware logging
 * - Error serialization
 * - Async error handling wrapper
 * - Error severity tracking
 * - User context association
 *
 * @returns Object with error handling functions
 *
 * @example
 * const { handleError, handleAsyncError } = useErrorHandler();
 *
 * try {
 *   await fetchData();
 * } catch (error) {
 *   handleError(error, {
 *     context: 'fetch-data',
 *     severity: 'high',
 *     userId: currentUserId
 *   });
 * }
 */
export const useErrorHandler = () => {
  const { trackEvent } = useAnalytics();

  /**
   * Format error for console output
   */
  const formatErrorForConsole = (error: AppError): void => {
    const icon = {
      low: 'ðŸŸ¡',
      medium: 'ðŸŸ ',
      high: 'ðŸ”´',
      critical: 'ðŸš¨',
    }[error.severity];

    console.group(
      `${icon} [${error.severity.toUpperCase()}] ${error.code} - ${error.context}`
    );
    console.error('Message:', error.message);
    console.error('Timestamp:', error.timestamp);
    if (error.userId) console.error('User ID:', error.userId);
    if (error.statusCode) console.error('Status Code:', error.statusCode);
    if (error.stack) console.error('Stack Trace:', error.stack);
    console.groupEnd();
  };

  /**
   * Send error to external error tracking service
   * Local error logging only — no external services
   */
  const sendToErrorTrackingService = async (errorLog: any): Promise<void> => {
    try {
      // Placeholder for error tracking service integration
      // No external error tracking — privacy first
      // Errors are logged locally only

      if (import.meta.env.MODE === 'development') {
        console.debug('Error would be sent to tracking service:', errorLog);
      }
    } catch (error) {
      console.error('Failed to send error to tracking service:', error);
    }
  };

  /**
   * Centralized error handler
   * Logs, tracks, and optionally sends errors to external services
   */
  const handleError = useCallback(
    (error: unknown, errorContext: ErrorContext) => {
      // Parse error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorCode = error instanceof AppError ? error.code : 'UNKNOWN_ERROR';
      const severity = errorContext.severity || (error instanceof AppError ? error.severity : 'medium');

      // Create structured error log
      const errorLog = {
        timestamp: new Date().toISOString(),
        errorMessage,
        errorCode,
        errorContext: errorContext.context,
        severity,
        userId: errorContext.userId || 'anonymous',
        extra: errorContext.extra,
        stack: errorStack,
        statusCode: errorContext.statusCode,
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...(error instanceof AppError && { originalError: error.toJSON() }),
      };

      // Console logging in development
      if (import.meta.env.MODE === 'development') {
        if (error instanceof AppError) {
          formatErrorForConsole(error);
        } else {
          console.group(`ðŸ”´ Error in ${errorContext.context}`);
          console.error('Error Message:', errorMessage);
          console.error('Error Code:', errorCode);
          if (errorStack) console.error('Stack:', errorStack);
          if (errorContext.extra) console.error('Extra Context:', errorContext.extra);
          console.groupEnd();
        }
      }

      // Analytics tracking
      trackEvent('error_occurred', {
        error_message: errorMessage,
        error_code: errorCode,
        error_context: errorContext.context,
        severity: severity,
        user_id: errorContext.userId || 'anonymous',
        timestamp: errorLog.timestamp,
        status_code: errorContext.statusCode,
      });

      // Send to external service for critical errors in production
      if (import.meta.env.MODE === 'production') {
        if (severity === 'critical') {
          sendToErrorTrackingService(errorLog);
        }
        // Log all errors to console in production for debugging
        console.error('[Production Error]', errorLog);
      }

      // Return error log for further processing if needed
      return errorLog;
    },
    [trackEvent]
  );

  /**
   * Wrapper for async operations with automatic error handling
   * Catches and handles errors automatically
   *
   * @param asyncFn Async function to execute
   * @param context Error context
   * @param options Additional error context options
   * @returns Result or null if error occurs
   *
   * @example
   * const result = await handleAsyncError(
   *   () => fetchUserData(userId),
   *   'fetch-user-data',
   *   { userId, severity: 'high' }
   * );
   */
  const handleAsyncError = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      context: string,
      options?: Partial<ErrorContext>
    ): Promise<T | null> => {
      try {
        return await asyncFn();
      } catch (error) {
        handleError(error, {
          context,
          ...options,
        });
        return null;
      }
    },
    [handleError]
  );

  /**
   * Wrapper for sync operations with error handling
   */
  const handleSyncError = useCallback(
    <T,>(
      syncFn: () => T,
      context: string,
      options?: Partial<ErrorContext>
    ): T | null => {
      try {
        return syncFn();
      } catch (error) {
        handleError(error, {
          context,
          ...options,
        });
        return null;
      }
    },
    [handleError]
  );

  /**
   * Throw an AppError with structured information
   */
  const throwAppError = useCallback(
    (
      message: string,
      code: string,
      context: string,
      severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
      extra?: Record<string, unknown>
    ): never => {
      const error = new AppError(message, code, context, severity);
      handleError(error, { context, severity, extra });
      throw error;
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
    handleSyncError,
    throwAppError,
    AppError,
  };
};

/**
 * Export types for use in other files
 */
export type UseErrorHandler = ReturnType<typeof useErrorHandler>;