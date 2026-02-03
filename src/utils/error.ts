/**
 * Error handling utilities
 *
 * Provides type-safe error message extraction without relying on `any`.
 */

/**
 * Safely extracts an error message from an unknown error type.
 *
 * This function handles the common error patterns:
 * - Error objects with a `message` property
 * - Strings thrown directly
 * - Objects with a `message` property
 * - Fallback to string conversion for other types
 *
 * @example
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   this.error(`API failed: ${getErrorMessage(error)}`);
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  // Last resort: convert to string
  try {
    return String(error);
  } catch {
    return 'An unknown error occurred';
  }
}

/**
 * Type guard to check if an error has a specific error code.
 *
 * Useful for handling specific API error codes.
 *
 * @example
 * if (hasErrorCode(error, 'RATE_LIMITED')) {
 *   // handle rate limiting
 * }
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is Error & { code: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

/**
 * Type guard to check if an error has a status code (common in HTTP errors).
 *
 * @example
 * if (hasStatusCode(error) && error.statusCode === 401) {
 *   // handle authentication error
 * }
 */
export function hasStatusCode(
  error: unknown
): error is Error & { statusCode: number } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}
