import { expect } from 'chai';
import { isRetryableError, calculateBackoffDelay, DEFAULT_RETRY_CONFIG } from '../../src/services/api.service.js';

describe('api service', () => {

  describe('isRetryableError', () => {
    it('returns true for rate limiting (429)', () => {
      const error = { statusCode: 429, message: 'Too Many Requests' };
      expect(isRetryableError(error)).to.be.true;
    });

    it('returns true for server errors (5xx)', () => {
      expect(isRetryableError({ statusCode: 500 })).to.be.true;
      expect(isRetryableError({ statusCode: 502 })).to.be.true;
      expect(isRetryableError({ statusCode: 503 })).to.be.true;
      expect(isRetryableError({ statusCode: 504 })).to.be.true;
    });

    it('returns true for network errors', () => {
      expect(isRetryableError({ code: 'ENOTFOUND' })).to.be.true;
      expect(isRetryableError({ code: 'ECONNREFUSED' })).to.be.true;
      expect(isRetryableError({ code: 'ECONNRESET' })).to.be.true;
      expect(isRetryableError({ code: 'ETIMEDOUT' })).to.be.true;
      expect(isRetryableError({ code: 'ESOCKETTIMEDOUT' })).to.be.true;
      expect(isRetryableError({ code: 'EPIPE' })).to.be.true;
    });

    it('returns false for client errors (4xx except 429)', () => {
      expect(isRetryableError({ statusCode: 400 })).to.be.false;
      expect(isRetryableError({ statusCode: 401 })).to.be.false;
      expect(isRetryableError({ statusCode: 403 })).to.be.false;
      expect(isRetryableError({ statusCode: 404 })).to.be.false;
    });

    it('returns false for unknown errors', () => {
      expect(isRetryableError(new Error('Unknown error'))).to.be.false;
      expect(isRetryableError({ message: 'Something went wrong' })).to.be.false;
    });

    it('returns false for null and undefined', () => {
      expect(isRetryableError(null)).to.be.false;
      expect(isRetryableError(undefined)).to.be.false;
    });

    it('returns false for primitive values', () => {
      expect(isRetryableError('error')).to.be.false;
      expect(isRetryableError(123)).to.be.false;
    });
  });

  describe('calculateBackoffDelay', () => {
    it('uses exponential backoff', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 100000 };

      // We can only check that the delay follows an exponential pattern
      // due to jitter, but we can verify the base calculation
      // attempt 0: baseDelay * 2^0 = 1000 ± 250 (jitter)
      // attempt 1: baseDelay * 2^1 = 2000 ± 500
      // attempt 2: baseDelay * 2^2 = 4000 ± 1000

      // Run multiple times and check bounds
      for (let i = 0; i < 10; i++) {
        const delay0 = calculateBackoffDelay(0, config);
        expect(delay0).to.be.at.least(750); // 1000 - 25%
        expect(delay0).to.be.at.most(1250); // 1000 + 25%
      }
    });

    it('respects maximum delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 5000 };

      // attempt 5: 1000 * 2^5 = 32000, should be capped at 5000
      const delay = calculateBackoffDelay(5, config);
      expect(delay).to.be.at.most(5000);
    });

    it('includes jitter to prevent thundering herd', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 100000 };
      const delays: number[] = [];

      // Generate multiple delays for the same attempt
      for (let i = 0; i < 20; i++) {
        delays.push(calculateBackoffDelay(1, config));
      }

      // Check that not all delays are the same (jitter is working)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).to.be.greaterThan(1);
    });

    it('increases delay with each attempt', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 100000 };

      // Average over multiple samples to account for jitter
      const getAverageDelay = (attempt: number) => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += calculateBackoffDelay(attempt, config);
        }
        return sum / 100;
      };

      const avgDelay0 = getAverageDelay(0);
      const avgDelay1 = getAverageDelay(1);
      const avgDelay2 = getAverageDelay(2);

      expect(avgDelay1).to.be.greaterThan(avgDelay0);
      expect(avgDelay2).to.be.greaterThan(avgDelay1);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).to.equal(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).to.equal(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).to.equal(10000);
    });
  });
});
