import {
    Account,
    AkahuClient,
    EnrichedTransaction,
    TransactionQueryParams,
} from "akahu";

import { getConfig } from '../utils/config.js';


const appToken = getConfig('appToken');
const userToken = getConfig('userToken');
const akahu = new AkahuClient({ appToken });

// Function to list accounts
export async function listAccounts(): Promise<Account[]> {
    return akahu.accounts.list(userToken);
}

// Function to list transactions
export async function listAllTransactions(startDate: string, endDate: string): Promise<EnrichedTransaction[]> {
    const transactionParams: TransactionQueryParams = {
        end: endDate,
        start: startDate,
    };

    let transactionPage = await akahu.transactions.list(
        userToken,
        transactionParams
    );

    let transactions: EnrichedTransaction[] =
        transactionPage.items as EnrichedTransaction[];

    while (transactionPage.cursor.next !== null) {
        transactionParams.cursor = transactionPage.cursor.next;
        // eslint-disable-next-line no-await-in-loop
        transactionPage = await akahu.transactions.list(
            userToken,
            transactionParams
        );
        transactions = [
            ...transactions,
            ...(transactionPage.items as EnrichedTransaction[]),
        ];
    }

    // Fetch pending transactions
    const pendingTransactionPage = await akahu.transactions.listPending(userToken) as EnrichedTransaction[];
    const pendingTransactions: EnrichedTransaction[] = pendingTransactionPage as EnrichedTransaction[];

    // Combine normal and pending transactions
    const allTransactions = [...transactions, ...pendingTransactions];


    return allTransactions;
}

// Function to trigger a data refresh for all linked accounts
export async function refreshUserData() {
    return akahu.accounts.refreshAll(userToken);
}

// Function to initiate a transfer
export async function initiateTransfer(params: {
    amount: number;
    description?: string;
    fromAccountId: string;
    reference?: string;
    toAccountId: string;
}) {

    const data = {
        amount: params.amount,
        description: params.description,
        from: params.fromAccountId,
        reference: params.reference,
        to: params.toAccountId,
    };

    const response = await akahu.transfers.create(userToken, data);
    return response._id; // Handle the response as per the API documentation
}

export async function getTransferStatus(transferId: string) {
    return akahu.transfers.get(userToken, transferId);
}

export async function listTransactions(params?: {
    accountId?: string;
    endDate?: string;
    startDate?: string;
}): Promise<EnrichedTransaction[]> {
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
        transactionPage = await akahu.accounts.listTransactions(userToken, params.accountId, transactionParams);
    } else {
        // Fetch all transactions
        transactionPage = await akahu.transactions.list(userToken, transactionParams);
    }

    transactions = transactionPage.items as EnrichedTransaction[];

    while (transactionPage.cursor.next !== null) {
        transactionParams.cursor = transactionPage.cursor.next;
        // eslint-disable-next-line no-await-in-loop
        transactionPage = await (params?.accountId ? akahu.accounts.listTransactions(userToken, params.accountId, transactionParams) : akahu.transactions.list(userToken, transactionParams));
        transactions = [
            ...transactions,
            ...(transactionPage.items as EnrichedTransaction[]),
        ];
    }

    return transactions;
}