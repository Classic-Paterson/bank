import {
    Account,
    AkahuClient,
    EnrichedTransaction,
    TransactionQueryParams,
} from "akahu";

import { configService } from '../services/config.service.js';
import { ApiError } from '../types/index.js';

/**
 * API service for interacting with Akahu banking API
 */
class ApiService {
    private akahu: AkahuClient;
    private userToken: string;

    constructor() {
        const appToken = configService.get<string>('appToken');
        this.userToken = configService.get<string>('userToken') || '';
        
        if (!appToken) {
            throw new Error('App token is required. Please configure it using: bank settings set app_token <token>');
        }
        
        this.akahu = new AkahuClient({ appToken });
    }

    private handleApiError(error: any, operation: string): never {
        const apiError = new Error(`${operation} failed: ${error.message}`) as ApiError;
        apiError.code = error.code;
        apiError.statusCode = error.statusCode;
        throw apiError;
    }

    /**
     * List all accounts
     */
    async listAccounts(): Promise<Account[]> {
        try {
            return await this.akahu.accounts.list(this.userToken);
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

            let transactionPage = await this.akahu.transactions.list(
                this.userToken,
                transactionParams
            );

            let transactions: EnrichedTransaction[] = transactionPage.items as EnrichedTransaction[];

            // Fetch all pages
            while (transactionPage.cursor.next !== null) {
                transactionParams.cursor = transactionPage.cursor.next;
                transactionPage = await this.akahu.transactions.list(
                    this.userToken,
                    transactionParams
                );
                transactions = [
                    ...transactions,
                    ...(transactionPage.items as EnrichedTransaction[]),
                ];
            }

            // Fetch pending transactions
            const pendingTransactionPage = await this.akahu.transactions.listPending(this.userToken);
            const pendingTransactions: EnrichedTransaction[] = pendingTransactionPage as EnrichedTransaction[];

            // Combine normal and pending transactions
            return [...transactions, ...pendingTransactions];
        } catch (error) {
            this.handleApiError(error, 'List transactions');
        }
    }

    /**
     * List transactions with optional filters
     */
    async listTransactions(params?: {
        accountId?: string;
        endDate?: string;
        startDate?: string;
    }): Promise<EnrichedTransaction[]> {
        try {
            const transactionParams: TransactionQueryParams = {};

            if (params?.startDate) {
                transactionParams.start = params.startDate;
            }

            if (params?.endDate) {
                transactionParams.end = params.endDate;
            }

            let transactions: EnrichedTransaction[] = [];
            let transactionPage;

            if (params?.accountId) {
                // Fetch transactions for a specific account
                transactionPage = await this.akahu.accounts.listTransactions(
                    this.userToken, 
                    params.accountId, 
                    transactionParams
                );
            } else {
                // Fetch all transactions
                transactionPage = await this.akahu.transactions.list(this.userToken, transactionParams);
            }

            transactions = transactionPage.items as EnrichedTransaction[];

            while (transactionPage.cursor.next !== null) {
                transactionParams.cursor = transactionPage.cursor.next;
                
                if (params?.accountId) {
                    transactionPage = await this.akahu.accounts.listTransactions(
                        this.userToken,
                        params.accountId,
                        transactionParams
                    );
                } else {
                    transactionPage = await this.akahu.transactions.list(this.userToken, transactionParams);
                }
                
                transactions = [
                    ...transactions,
                    ...(transactionPage.items as EnrichedTransaction[]),
                ];
            }

            return transactions;
        } catch (error) {
            this.handleApiError(error, 'List filtered transactions');
        }
    }

    /**
     * Trigger a data refresh for all linked accounts
     */
    async refreshUserData(): Promise<any> {
        try {
            return await this.akahu.accounts.refreshAll(this.userToken);
        } catch (error) {
            this.handleApiError(error, 'Refresh user data');
        }
    }

    /**
     * Initiate a transfer between accounts
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

            const response = await this.akahu.transfers.create(this.userToken, data);
            return response._id;
        } catch (error) {
            this.handleApiError(error, 'Initiate transfer');
        }
    }

    /**
     * Get transfer status
     */
    async getTransferStatus(transferId: string): Promise<any> {
        try {
            return await this.akahu.transfers.get(this.userToken, transferId);
        } catch (error) {
            this.handleApiError(error, 'Get transfer status');
        }
    }
}

// Export singleton instance
export const apiService = new ApiService();

// Legacy compatibility functions for existing code
export async function listAccounts(): Promise<Account[]> {
    return apiService.listAccounts();
}

export async function listAllTransactions(startDate: string, endDate: string): Promise<EnrichedTransaction[]> {
    return apiService.listAllTransactions(startDate, endDate);
}

export async function listTransactions(params?: {
    accountId?: string;
    endDate?: string;
    startDate?: string;
}): Promise<EnrichedTransaction[]> {
    return apiService.listTransactions(params);
}

export async function refreshUserData(): Promise<any> {
    return apiService.refreshUserData();
}

export async function initiateTransfer(params: {
    amount: number;
    description?: string;
    fromAccountId: string;
    reference?: string;
    toAccountId: string;
}): Promise<string> {
    return apiService.initiateTransfer(params);
}

export async function getTransferStatus(transferId: string): Promise<any> {
    return apiService.getTransferStatus(transferId);
}
