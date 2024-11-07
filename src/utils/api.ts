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
    return await akahu.accounts.list(userToken);
}

// Function to list transactions
export async function listAllTransactions(startDate: string, endDate: string): Promise<EnrichedTransaction[]> {
    const transactionParams: TransactionQueryParams = {
        start: startDate,
        end: endDate,
    };
    let transactionPage = await akahu.transactions.list(
        userToken,
        transactionParams
    );

    let transactions: EnrichedTransaction[] =
        transactionPage.items as EnrichedTransaction[];

    while (transactionPage.cursor.next !== null) {
        transactionParams.cursor = transactionPage.cursor.next;
        transactionPage = await akahu.transactions.list(
            userToken,
            transactionParams
        );
        transactions = [
            ...transactions,
            ...(transactionPage.items as EnrichedTransaction[]),
        ];
    }
    return transactions;
}