import {expect} from 'chai'
import {
  formatCacheAge,
  formatCurrency,
  formatRelativeTime,
  isValidOutputFormat,
  validateOutputFormat,
} from '../../src/utils/output.js'

describe('output utilities', () => {
  describe('formatCacheAge', () => {
    it('returns fallback message for null input', () => {
      expect(formatCacheAge(null)).to.equal('(using cached data)')
    })

    it('returns "just now" for very recent cache', () => {
      const now = new Date().toISOString()
      expect(formatCacheAge(now)).to.equal('(using cached data from just now)')
    })

    it('formats minutes ago correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(formatCacheAge(fiveMinutesAgo)).to.equal('(using cached data from 5m ago)')
    })

    it('formats hours ago correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      expect(formatCacheAge(twoHoursAgo)).to.equal('(using cached data from 2h ago)')
    })

    it('formats days ago correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      expect(formatCacheAge(threeDaysAgo)).to.equal('(using cached data from 3d ago)')
    })

    it('handles invalid date string', () => {
      expect(formatCacheAge('invalid-date')).to.equal('(using cached data)')
    })

    it('handles edge case at 59 minutes', () => {
      const fiftyNineMinutesAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString()
      expect(formatCacheAge(fiftyNineMinutesAgo)).to.equal('(using cached data from 59m ago)')
    })

    it('handles edge case at 60 minutes (switches to hours)', () => {
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      expect(formatCacheAge(sixtyMinutesAgo)).to.equal('(using cached data from 1h ago)')
    })

    it('handles edge case at 23 hours', () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
      expect(formatCacheAge(twentyThreeHoursAgo)).to.equal('(using cached data from 23h ago)')
    })

    it('handles edge case at 24 hours (switches to days)', () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      expect(formatCacheAge(twentyFourHoursAgo)).to.equal('(using cached data from 1d ago)')
    })
  })

  describe('formatCurrency', () => {
    it('formats positive amounts with $ sign', () => {
      expect(formatCurrency(100)).to.equal('$100.00')
    })

    it('formats negative amounts with -$ prefix', () => {
      expect(formatCurrency(-100)).to.equal('-$100.00')
    })

    it('handles zero correctly', () => {
      expect(formatCurrency(0)).to.equal('$0.00')
    })

    it('rounds to 2 decimal places', () => {
      expect(formatCurrency(99.999)).to.equal('$100.00')
      expect(formatCurrency(99.994)).to.equal('$99.99')
    })

    it('handles small decimal amounts', () => {
      expect(formatCurrency(0.01)).to.equal('$0.01')
      expect(formatCurrency(0.1)).to.equal('$0.10')
    })

    it('adds thousands separators for large amounts', () => {
      expect(formatCurrency(1234.56)).to.equal('$1,234.56')
      expect(formatCurrency(1234567.89)).to.equal('$1,234,567.89')
    })

    it('handles negative large amounts with separators', () => {
      expect(formatCurrency(-1234.56)).to.equal('-$1,234.56')
      expect(formatCurrency(-1234567.89)).to.equal('-$1,234,567.89')
    })
  })

  describe('formatRelativeTime', () => {
    it('handles "just now" for very recent times', () => {
      const now = new Date()
      expect(formatRelativeTime(now)).to.equal('just now')
    })

    it('formats minutes ago correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      expect(formatRelativeTime(fiveMinutesAgo)).to.equal('5m ago')
    })

    it('formats hours ago correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      expect(formatRelativeTime(twoHoursAgo)).to.equal('2h ago')
    })

    it('handles yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(yesterday)).to.equal('yesterday')
    })

    it('formats days ago correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(threeDaysAgo)).to.equal('3d ago')
    })

    it('accepts ISO date strings', () => {
      const now = new Date()
      const isoString = now.toISOString()
      expect(formatRelativeTime(isoString)).to.equal('just now')
    })

    it('formats future dates with "in" prefix', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(tomorrow)).to.equal('tomorrow')
    })

    it('formats future minutes correctly', () => {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      expect(formatRelativeTime(fiveMinutesFromNow)).to.equal('in 5m')
    })

    it('formats weeks ago with full text by default', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(twoWeeksAgo)).to.equal('2 weeks ago')
    })

    it('formats 1 week ago with singular form', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(oneWeekAgo)).to.equal('1 week ago')
    })

    describe('compact mode', () => {
      it('uses "today" instead of "just now" for same-day times', () => {
        const now = new Date()
        expect(formatRelativeTime(now, { compact: true })).to.equal('today')
      })

      it('uses "today" for hours ago in compact mode', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        expect(formatRelativeTime(twoHoursAgo, { compact: true })).to.equal('today')
      })

      it('handles yesterday the same in compact mode', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(yesterday, { compact: true })).to.equal('yesterday')
      })

      it('uses abbreviated weeks in compact mode', () => {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(twoWeeksAgo, { compact: true })).to.equal('2w ago')
      })

      it('falls back to date string for older times in compact mode', () => {
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        const result = formatRelativeTime(twoMonthsAgo, { compact: true })
        // Should be a locale date string, not "2 months ago"
        expect(result).to.not.include('months')
        expect(result).to.not.include('ago')
      })

      it('handles future dates in compact mode', () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(tomorrow, { compact: true })).to.equal('tomorrow')
      })

      it('uses abbreviated future weeks in compact mode', () => {
        const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(twoWeeksFromNow, { compact: true })).to.equal('in 2w')
      })
    })
  })

  describe('isValidOutputFormat', () => {
    it('accepts valid formats', () => {
      expect(isValidOutputFormat('json')).to.be.true
      expect(isValidOutputFormat('csv')).to.be.true
      expect(isValidOutputFormat('table')).to.be.true
      expect(isValidOutputFormat('list')).to.be.true
      expect(isValidOutputFormat('ndjson')).to.be.true
    })

    it('is case insensitive', () => {
      expect(isValidOutputFormat('JSON')).to.be.true
      expect(isValidOutputFormat('CSV')).to.be.true
      expect(isValidOutputFormat('Table')).to.be.true
    })

    it('rejects invalid formats', () => {
      expect(isValidOutputFormat('xml')).to.be.false
      expect(isValidOutputFormat('yaml')).to.be.false
      expect(isValidOutputFormat('')).to.be.false
      expect(isValidOutputFormat('invalid')).to.be.false
    })
  })

  describe('validateOutputFormat', () => {
    it('returns normalized format for valid inputs', () => {
      expect(validateOutputFormat('JSON')).to.equal('json')
      expect(validateOutputFormat('CSV')).to.equal('csv')
      expect(validateOutputFormat('Table')).to.equal('table')
    })

    it('throws for invalid formats', () => {
      expect(() => validateOutputFormat('invalid')).to.throw('Invalid output format')
      expect(() => validateOutputFormat('xml')).to.throw('Invalid output format')
    })

    it('includes supported formats in error message', () => {
      try {
        validateOutputFormat('invalid')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).to.include('json')
        expect(error.message).to.include('csv')
        expect(error.message).to.include('table')
      }
    })
  })
})
