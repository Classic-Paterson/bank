// Legacy compatibility layer - redirects to new service
export {
  loadMerchantMap,
  saveMerchantMap,
  upsertMerchantCategory,
} from '../services/merchant-mapping.service.js';

export type { MerchantCategory, MerchantMap } from '../types/index.js';
