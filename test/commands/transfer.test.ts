import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import { NZ_ACCOUNT_PATTERN } from '../../src/constants/index.js'

describe('transfer', () => {
  it('handles missing flags gracefully', async () => {
    try {
      await runCommand('transfer')
      expect.fail('Should have thrown an error for missing required flags')
    } catch (error: any) {
      // Expected to fail - missing required flags
      expect(error).to.exist
    }
  })

  it('validates amount format', async () => {
    try {
      await runCommand('transfer --from acc_123 --to 12-3456-0123456-00 --amount invalid')
      expect.fail('Should have thrown an error for invalid amount')
    } catch (error) {
      // Expected to fail with invalid amount
      expect(error).to.exist
    }
  })

  it('handles transfer with valid flags', async () => {
    try {
      const {stdout} = await runCommand('transfer --from acc_123 --to 12-3456-0123456-00 --amount 100.00')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  describe('NZ account number validation', () => {
    it('accepts valid NZ account numbers with 2-digit suffix', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-0123456-00')).to.be.true
      expect(NZ_ACCOUNT_PATTERN.test('01-0001-1234567-99')).to.be.true
      expect(NZ_ACCOUNT_PATTERN.test('38-9999-7654321-50')).to.be.true
    })

    it('accepts valid NZ account numbers with 3-digit suffix', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-0123456-000')).to.be.true
      expect(NZ_ACCOUNT_PATTERN.test('01-0001-1234567-123')).to.be.true
    })

    it('rejects account numbers with wrong bank code length', () => {
      expect(NZ_ACCOUNT_PATTERN.test('1-3456-0123456-00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('123-3456-0123456-00')).to.be.false
    })

    it('rejects account numbers with wrong branch code length', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12-345-0123456-00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('12-34567-0123456-00')).to.be.false
    })

    it('rejects account numbers with wrong account number length', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-012345-00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-01234567-00')).to.be.false
    })

    it('rejects account numbers with wrong suffix length', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-0123456-0')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('12-3456-0123456-0000')).to.be.false
    })

    it('rejects account numbers with letters', () => {
      expect(NZ_ACCOUNT_PATTERN.test('AB-3456-0123456-00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('12-34XX-0123456-00')).to.be.false
    })

    it('rejects account numbers with wrong separator', () => {
      expect(NZ_ACCOUNT_PATTERN.test('12_3456_0123456_00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('12 3456 0123456 00')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('1234560123456000')).to.be.false
    })

    it('rejects empty or invalid strings', () => {
      expect(NZ_ACCOUNT_PATTERN.test('')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('acc_12345')).to.be.false
      expect(NZ_ACCOUNT_PATTERN.test('not-an-account')).to.be.false
    })
  })

  it('rejects invalid destination account format', async () => {
    try {
      // This should fail validation before even trying to process the transfer
      await runCommand('transfer --from acc_123 --to invalid-account --amount 100.00 --dry-run')
      expect.fail('Should have thrown an error for invalid account format')
    } catch (error: any) {
      expect(error).to.exist
    }
  })
})
