// Legacy compatibility layer - redirects to new service
export {
  listAccounts,
  listAllTransactions,
  listTransactions,
  refreshUserData,
  initiateTransfer,
  getTransferStatus,
} from '../services/api.service.js';
