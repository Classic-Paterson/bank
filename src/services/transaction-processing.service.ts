import { Account, EnrichedTransaction } from 'akahu';
import { FormattedTransaction, TransactionFilter } from '../types/index.js';
import { isExcludedTransactionType, UNCATEGORIZED } from '../constants/index.js';
import { merchantMappingService, normaliseMerchantName } from './merchant-mapping.service.js';
import { formatRelativeTime } from '../utils/output.js';

/**
 * Service for processing and filtering transactions
 */
class TransactionProcessingService {
  /**
   * Format transactions for display.
   * Uses Map-based account lookup for O(1) performance instead of O(n) find().
   * Applies user-defined merchant mappings to override categories for known merchants.
   *
   * @param transactions - Raw transactions from API
   * @param accounts - Account list for name/number resolution
   * @param applyMerchantMappings - Whether to apply user-defined merchant→category mappings (default: true)
   */
  formatTransactions(
    transactions: EnrichedTransaction[],
    accounts: Account[],
    applyMerchantMappings = true
  ): FormattedTransaction[] {
    // Build account lookup map for O(1) access
    const accountMap = new Map(accounts.map(acc => [acc._id, acc]));

    // Load merchant mappings once if needed (cached in service)
    const merchantMap = applyMerchantMappings ? merchantMappingService.loadMerchantMap() : {};

    return transactions.map(transaction => {
      const account = accountMap.get(transaction._account);
      const merchantName = transaction.merchant?.name ?? '';

      // Check for user-defined merchant mapping first (using normalized key for consistent lookups)
      const normalizedMerchantName = merchantName ? normaliseMerchantName(merchantName) : '';
      const merchantMapping = normalizedMerchantName ? merchantMap[normalizedMerchantName] : undefined;

      // Use merchant mapping if available, otherwise fall back to API categories
      const parentCategory = merchantMapping?.parent
        ?? transaction.category?.groups?.['personal_finance']?.name
        ?? UNCATEGORIZED;
      const category = merchantMapping?.category
        ?? transaction.category?.name
        ?? UNCATEGORIZED;

      return {
        id: transaction._id,
        date: new Date(transaction.date),
        accountName: account?.name ?? '',
        accountNumber: account?.formatted_account ?? '',
        amount: transaction.amount,
        particulars: transaction.meta?.particulars ?? '',
        description: transaction.description,
        merchant: merchantName,
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

    // Apply merchant filter (supports comma-separated list)
    if (filters.merchant) {
      const merchants = filters.merchant
        .split(',')
        .map(m => m.trim().toLowerCase())
        .filter(m => m.length > 0); // Exclude empty strings that would match everything

      if (merchants.length > 0) {
        filtered = filtered.filter(tx =>
          merchants.some(m => tx.merchant.toLowerCase().includes(m))
        );
      }
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

    // Apply search filter (matches transaction ID or description, case-insensitive)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.id.toLowerCase() === searchTerm ||
        (tx.description ?? '').toLowerCase().includes(searchTerm)
      );
    }

    // Apply direction filter (in = income/positive, out = spending/negative)
    if (filters.direction) {
      if (filters.direction === 'in') {
        filtered = filtered.filter(tx => tx.amount > 0);
      } else if (filters.direction === 'out') {
        filtered = filtered.filter(tx => tx.amount < 0);
      }
    }

    return filtered;
  }

  /**
   * Calculate category breakdown for spending analysis
   */
  calculateCategoryBreakdown(transactions: FormattedTransaction[]): Record<string, number> {
    return transactions.reduce((acc, tx) => {
      // Skip transfers and income (positive amounts)
      if (isExcludedTransactionType(tx.type) || tx.amount >= 0) {
        return acc;
      }

      const category = tx.parentCategory.toLowerCase().trim() || UNCATEGORIZED;
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
      .filter(tx => tx.amount < 0 && !isExcludedTransactionType(tx.type))
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
      !isExcludedTransactionType(tx.type) &&
      (!tx.category?.name || !tx.category?.groups?.['personal_finance']?.name)
    );
  }

  /**
   * Generate display data based on format requirements.
   * Handles date formatting (Date to string) and field selection for lean table views.
   * @param transactions - Array of formatted transactions
   * @param format - Output format (table, json, csv, etc.)
   * @param showDetails - Whether to include all fields
   * @param useRelativeTime - Whether to show relative time (e.g., "2d ago") instead of dates
   * @returns Array of display-ready objects with dates as strings
   */
  generateDisplayData(
    transactions: FormattedTransaction[],
    format: string,
    showDetails: boolean,
    useRelativeTime = false
  ): Array<Record<string, string | number>> {
    // First, convert dates to strings for display
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      date: useRelativeTime
        ? formatRelativeTime(tx.date, { compact: true })
        : tx.date.toLocaleDateString(),
    }));

    // For table format without details, show a lean view with key fields only
    if (format.toLowerCase() === 'table' && !showDetails) {
      return formattedTransactions.map(tx => ({
        date: tx.date,
        account: tx.accountName,
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
      }));
    }

    return formattedTransactions;
  }
}

// Export singleton instance
export const transactionProcessingService = new TransactionProcessingService();
