import {expect} from 'chai'
import {
  maskSensitiveValue,
  maskAccountNumber,
} from '../../src/utils/mask.js'

describe('mask utilities', () => {
  describe('maskSensitiveValue', () => {
    it('fully masks values shorter than 9 characters', () => {
      expect(maskSensitiveValue('abc')).to.equal('***')
      expect(maskSensitiveValue('12345678')).to.equal('********')
    })

    it('partially masks values of 9+ characters', () => {
      // 9 chars: first 4 + 1 star + last 4
      expect(maskSensitiveValue('abcdefghi')).to.equal('abcd*fghi')
    })

    it('shows more stars for longer values', () => {
      // 12 chars: first 4 + 4 stars + last 4
      expect(maskSensitiveValue('abcdefghijkl')).to.equal('abcd****ijkl')
    })

    it('handles very long tokens', () => {
      // 20 chars: first 4 + 12 stars + last 4
      const token = '12345678901234567890'
      expect(maskSensitiveValue(token)).to.equal('1234************7890')
    })

    it('handles empty string', () => {
      expect(maskSensitiveValue('')).to.equal('')
    })

    it('handles single character', () => {
      expect(maskSensitiveValue('a')).to.equal('*')
    })

    it('handles exactly 8 characters (boundary case)', () => {
      expect(maskSensitiveValue('12345678')).to.equal('********')
    })

    it('handles exactly 9 characters (boundary case)', () => {
      expect(maskSensitiveValue('123456789')).to.equal('1234*6789')
    })
  })

  describe('maskAccountNumber', () => {
    it('masks NZ bank account numbers in standard format', () => {
      expect(maskAccountNumber('12-3456-0123456-00')).to.equal('12-****-*******-00')
    })

    it('handles 3-digit suffix', () => {
      expect(maskAccountNumber('12-3456-0123456-001')).to.equal('12-****-*******-001')
    })

    it('preserves bank code and suffix', () => {
      expect(maskAccountNumber('01-0001-0000001-00')).to.equal('01-****-*******-00')
      expect(maskAccountNumber('99-9999-9999999-999')).to.equal('99-****-*******-999')
    })

    it('falls back to generic masking for invalid formats', () => {
      // Missing parts - 7 chars, fully masked
      expect(maskAccountNumber('12-3456')).to.equal('*******')
      // Wrong digit counts - 19 chars, partial mask (first 4 + 11 stars + last 4)
      expect(maskAccountNumber('123-3456-0123456-00')).to.equal('123-***********6-00')
      // 20 chars, partial mask (first 4 + 11 stars + last 4)
      expect(maskAccountNumber('12-34567-0123456-00')).to.equal('12-3***********6-00')
    })

    it('falls back for non-NZ account formats', () => {
      // 10 chars, partial mask (first 4 + 2 stars + last 4)
      expect(maskAccountNumber('ACC-123456')).to.equal('ACC-**3456')
      // 11 chars, partial mask (first 4 + 3 stars + last 4)
      expect(maskAccountNumber('someaccount')).to.equal('some***ount')
    })

    it('handles empty string', () => {
      expect(maskAccountNumber('')).to.equal('')
    })

    it('handles account number with only dashes', () => {
      expect(maskAccountNumber('----')).to.equal('****')
    })

    it('handles single-digit bank code (invalid but should not crash)', () => {
      expect(maskAccountNumber('1-3456-0123456-00')).to.have.length.greaterThan(0)
    })
  })
})
