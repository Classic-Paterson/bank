import {
    Account,
    AkahuClient,
    EnrichedTransaction,
    Transfer,
    TransactionQueryParams,
} from "akahu";

import { configService } from '../services/config.service.js';
import { ApiError } from '../types/index.js';
import { hasStatusCode, hasErrorCode, getErrorMessage } from '../utils/error.js';

/** Configuration for retry behavior */
interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries: number;
    /** Base delay in milliseconds (default: 1000) */
    baseDelayMs: number;
    /** Maximum delay in milliseconds (default: 10000) */
    maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
};

/**
 * Check if an error is retryable (transient network errors or rate limiting)
 */
function isRetryableError(error: unknown): boolean {
    // Rate limiting
    if (hasStatusCode(error) && error.statusCode === 429) {
        return true;
    }

    // Server errors (5xx) are often transient
    if (hasStatusCode(error) && error.statusCode >= 500 && error.statusCode < 600) {
        return true;
    }

    // Network errors
    if (hasErrorCode(error, 'ENOTFOUND') ||
        hasErrorCode(error, 'ECONNREFUSED') ||
        hasErrorCode(error, 'ECONNRESET') ||
        hasErrorCode(error, 'ETIMEDOUT') ||
        hasErrorCode(error, 'ESOCKETTIMEDOUT') ||
        hasErrorCode(error, 'EPIPE')) {
        return true;
    }

    return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    // Add jitter (±25%) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.round(exponentialDelay + jitter);
    // Cap at maximum delay
    return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API service for interacting with Akahu banking API
 */
class ApiService {
    private akahu: AkahuClient;
    private userToken: string;
    private retryConfig: RetryConfig;

    constructor(retryConfig?: Partial<RetryConfig>) {
        const appToken = configService.get<string>('appToken');
        this.userToken = configService.get<string>('userToken') || '';
        this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

        if (!appToken) {
            throw new Error(
                'App token is not configured.\n\n' +
                'To get started:\n' +
                '  1. Get your Akahu app token from https://my.akahu.nz/developers\n' +
                '  2. Run: bank settings set appToken <your-app-token>\n' +
                '  3. Run: bank settings set userToken <your-user-token>'
            );
        }

        if (!this.userToken) {
            throw new Error(
                'User token is not configured.\n\n' +
                'Run: bank settings set userToken <your-user-token>\n' +
                'Get your user token from https://my.akahu.nz/developers'
            );
        }

        this.akahu = new AkahuClient({ appToken });
    }

    /**
     * Execute an API operation with retry logic for transient failures.
     * Uses exponential backoff with jitter.
     */
    private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: unknown;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry non-retryable errors
                if (!isRetryableError(error)) {
                    throw error;
                }

                // Don't retry if we've exhausted retries
                if (attempt >= this.retryConfig.maxRetries) {
                    break;
                }

                const delay = calculateBackoffDelay(attempt, this.retryConfig);
                await sleep(delay);
            }
        }

        // If we get here, all retries failed
        throw lastError;
    }

    private handleApiError(error: unknown, operation: string): never {
        // Build actionable error message based on error type
        const message = `${operation} failed: ${getErrorMessage(error)}`;
        let hint = '';

        // Check for specific HTTP status codes
        if (hasStatusCode(error)) {
            switch (error.statusCode) {
                case 401:
                    hint = '\n\nYour tokens may be invalid or expired. Try:\n' +
                           '  bank settings set appToken <your-app-token>\n' +
                           '  bank settings set userToken <your-user-token>';
                    break;
                case 403:
                    hint = '\n\nAccess denied. Check that your tokens have the required permissions.';
                    break;
                case 404:
                    hint = '\n\nResource not found. The account or transaction may no longer exist.';
                    break;
                case 429:
                    hint = '\n\nRate limited. Please wait a moment and try again.';
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    hint = '\n\nAkahu service issue. Please try again later.';
                    break;
            }
        }

        // Check for specific error codes
        if (hasErrorCode(error, 'ENOTFOUND') || hasErrorCode(error, 'ECONNREFUSED')) {
            hint = '\n\nNetwork error. Check your internet connection.';
        } else if (hasErrorCode(error, 'ETIMEDOUT') || hasErrorCode(error, 'ESOCKETTIMEDOUT')) {
            hint = '\n\nRequest timed out. Please try again.';
        }

        const apiError = new Error(message + hint) as ApiError;
        if (hasStatusCode(error)) {
            apiError.statusCode = error.statusCode;
        }
        // Extract error code if present
        const errorWithCode = error as { code?: string };
        if (errorWithCode.code) {
            apiError.code = errorWithCode.code;
        }
        throw apiError;
    }

    /**
     * List all accounts
     */
    async listAccounts(): Promise<Account[]> {
        try {
            return await this.withRetry(() => this.akahu.accounts.list(this.userToken));
        } catch (error) {
            this.handleApiError(error, 'List accounts');
        }
    }

    /**
     * List all transactions within a date range
     */
    async listAllTransactions(startDate: string, endDate: string): Promise<EnrichedTransaction[]> {
        try {
            const transactionParams: TransactionQueryParams = {
                end: endDate,
                start: startDate,
            };

            let transactionPage = await this.withRetry(
                () => this.akahu.transactions.list(this.userToken, transactionParams)
            );

            let transactions: EnrichedTransaction[] = transactionPage.items as EnrichedTransaction[];

            // Fetch all pages with retry on each page
            while (transactionPage.cursor.next !== null) {
                transactionParams.cursor = transactionPage.cursor.next;
                transactionPage = await this.withRetry(
                    () => this.akahu.transactions.list(this.userToken, transactionParams)
                );
                transactions = [
                    ...transactions,
                    ...(transactionPage.items as EnrichedTransaction[]),
                ];
            }

            // Fetch pending transactions with retry
            const pendingTransactionPage = await this.withRetry(
                () => this.akahu.transactions.listPending(this.userToken)
            );
            const pendingTransactions: EnrichedTransaction[] = pendingTransactionPage as EnrichedTransaction[];

            // Combine normal and pending transactions
            return [...transactions, ...pendingTransactions];
        } catch (error) {
            this.handleApiError(error, 'List transactions');
        }
    }

    /**
     * Trigger a data refresh for all linked accounts
     */
    async refreshUserData(): Promise<void> {
        try {
            await this.withRetry(() => this.akahu.accounts.refreshAll(this.userToken));
        } catch (error) {
            this.handleApiError(error, 'Refresh user data');
        }
    }

    /**
     * Initiate a transfer between accounts.
     * Note: Transfers are NOT retried automatically to prevent duplicate transactions.
     * If a transfer fails with a transient error, the user must manually retry.
     */
    async initiateTransfer(params: {
        amount: number;
        description?: string;
        fromAccountId: string;
        reference?: string;
        toAccountId: string;
    }): Promise<string> {
        try {
            const data = {
                amount: params.amount,
                description: params.description,
                from: params.fromAccountId,
                reference: params.reference,
                to: params.toAccountId,
            };

            // Intentionally NOT using withRetry here - transfers should not auto-retry
            // to prevent potential duplicate transactions if the request succeeded but
            // the response was lost due to a network error
            const response = await this.akahu.transfers.create(this.userToken, data);
            return response._id;
        } catch (error) {
            this.handleApiError(error, 'Initiate transfer');
        }
    }

    /**
     * Get transfer status
     */
    async getTransferStatus(transferId: string): Promise<Transfer> {
        try {
            return await this.withRetry(() => this.akahu.transfers.get(this.userToken, transferId));
        } catch (error) {
            this.handleApiError(error, 'Get transfer status');
        }
    }
}

// Export singleton instance
export const apiService = new ApiService();

// Export utilities for testing
export { isRetryableError, calculateBackoffDelay, RetryConfig, DEFAULT_RETRY_CONFIG };
