import { Account, EnrichedTransaction } from 'akahu';
import { FormattedTransaction, TransactionFilter } from '../types/index.js';
import { EXCLUDED_TRANSACTION_TYPES } from '../constants/index.js';

/**
 * Service for processing and filtering transactions
 */
class TransactionProcessingService {
  /**
   * Format transactions for display
   */
  formatTransactions(
    transactions: EnrichedTransaction[],
    accounts: Account[]
  ): FormattedTransaction[] {
    return transactions.map(transaction => {
      const account = accounts.find(acc => acc._id === transaction._account);
      const parentCategory = transaction.category?.groups?.['personal_finance']?.name ?? 'Uncategorized';
      const category = transaction.category?.name ?? 'Uncategorized';

      return {
        id: transaction._id,
        date: new Date(transaction.date),
        accountName: account?.name ?? '',
        accountNumber: account?.formatted_account ?? '',
        amount: transaction.amount,
        particulars: transaction.meta?.particulars ?? '',
        description: transaction.description,
        merchant: transaction.merchant?.name ?? '',
        parentCategory,
        category,
        type: transaction.type,
      };
    });
  }

  /**
   * Apply filters to transactions
   */
  applyFilters(
    transactions: FormattedTransaction[],
    filters: TransactionFilter
  ): FormattedTransaction[] {
    let filtered = [...transactions];

    // Sort by date first
    filtered.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Apply account filter
    if (filters.accountId) {
      filtered = filtered.filter(tx =>
        tx.accountNumber === filters.accountId ||
        tx.accountName.toLowerCase() === filters.accountId!.toLowerCase()
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(tx =>
        tx.category.toLowerCase().includes(filters.category!.toLowerCase())
      );
    }

    // Apply parent category filter
    if (filters.parentCategory) {
      filtered = filtered.filter(tx =>
        tx.parentCategory.toLowerCase() === filters.parentCategory!.toLowerCase()
      );
    }

    // Apply merchant filter
    if (filters.merchant) {
      filtered = filtered.filter(tx =>
        tx.merchant.toLowerCase().includes(filters.merchant!.toLowerCase())
      );
    }

    // Apply amount filters
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter(tx => Math.abs(tx.amount) >= filters.minAmount!);
    }

    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter(tx => Math.abs(tx.amount) <= filters.maxAmount!);
    }

    // Apply transaction type filter
    if (filters.type) {
      filtered = filtered.filter(tx =>
        tx.type.toLowerCase().includes(filters.type!.toLowerCase())
      );
    }

    return filtered;
  }

  /**
   * Calculate category breakdown for spending analysis
   */
  calculateCategoryBreakdown(transactions: FormattedTransaction[]): Record<string, number> {
    return transactions.reduce((acc, tx) => {
      // Skip transfers and income (positive amounts)
      if (EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any) || tx.amount >= 0) {
        return acc;
      }

      const category = tx.parentCategory.toLowerCase().trim() || 'Uncategorized';
      acc[category] = (acc[category] || 0) + Math.abs(tx.amount);
      
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(transactions: FormattedTransaction[]) {
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSpending = transactions
      .filter(tx => tx.amount < 0 && !EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return {
      totalTransactions,
      totalAmount,
      totalSpending,
    };
  }

  /**
   * Get transactions that need categorization
   */
  getUncategorizedTransactions(transactions: EnrichedTransaction[]): EnrichedTransaction[] {
    return transactions.filter(tx =>
      !EXCLUDED_TRANSACTION_TYPES.includes(tx.type as any) &&
      (!tx.category?.name || !tx.category?.groups?.['personal_finance']?.name)
    );
  }

  /**
   * Generate display data based on format requirements
   */
  generateDisplayData(
    transactions: FormattedTransaction[],
    format: string,
    showDetails: boolean
  ) {
    if (format.toLowerCase() === 'table' && !showDetails) {
      return transactions.map(tx => ({
        date: tx.date,
        account: tx.accountName,
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
      }));
    }

    return transactions;
  }
}

// Export singleton instance
export const transactionProcessingService = new TransactionProcessingService();
