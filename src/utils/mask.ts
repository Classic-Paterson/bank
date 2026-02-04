/**
 * Masking utilities for sensitive data display.
 * Provides consistent masking across the CLI for tokens, account numbers, etc.
 */

import { MASK_MIN_LENGTH_FOR_PARTIAL } from '../constants/index.js';

/**
 * Masks a sensitive string value for secure display.
 * Shows first 4 and last 4 characters for values >= 9 chars.
 * Fully masks shorter values for security.
 *
 * @param value - The sensitive string to mask
 * @returns Masked string with asterisks
 *
 * @example
 * maskSensitiveValue('abcdefghi')    // 'abcd*efgi'
 * maskSensitiveValue('short')        // '*****'
 * maskSensitiveValue('verylongtokenhere') // 'very******here'
 */
export function maskSensitiveValue(value: string): string {
  if (value.length < MASK_MIN_LENGTH_FOR_PARTIAL) {
    return '*'.repeat(value.length);
  }
  return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
}

/**
 * Masks an NZ bank account number for secure display.
 * Format: BB-bbbb-AAAAAAA-SS -> BB-****-*******-SS
 * Shows bank code and suffix, hides branch and account number.
 * Falls back to standard masking for non-standard formats.
 *
 * @param accountNumber - The account number to mask
 * @returns Masked account string
 *
 * @example
 * maskAccountNumber('12-3456-0123456-00')  // '12-****-*******-00'
 * maskAccountNumber('12-3456-0123456-001') // '12-****-*******-001'
 * maskAccountNumber('someotherformat')      // '****otherformat' (fallback)
 */
export function maskAccountNumber(accountNumber: string): string {
  // Handle NZ bank account format (BB-bbbb-AAAAAAA-SS(S))
  const parts = accountNumber.split('-');

  // Validate format: 4 parts with correct digit counts
  if (parts.length === 4 &&
      /^\d{2}$/.test(parts[0]) &&      // Bank code: 2 digits
      /^\d{4}$/.test(parts[1]) &&      // Branch: 4 digits
      /^\d{7}$/.test(parts[2]) &&      // Account: 7 digits
      /^\d{2,3}$/.test(parts[3])) {    // Suffix: 2-3 digits
    // Show bank code and suffix, mask middle sections completely
    return `${parts[0]}-****-*******-${parts[3]}`;
  }

  // Fallback for other formats
  return maskSensitiveValue(accountNumber);
}
