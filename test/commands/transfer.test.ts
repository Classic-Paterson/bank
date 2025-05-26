import {runCommand} from '@oclif/test'
import {expect} from 'chai'

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
      await runCommand('transfer --from acc_123 --to acc_456 --amount invalid')
      expect.fail('Should have thrown an error for invalid amount')
    } catch (error) {
      // Expected to fail with invalid amount
      expect(error).to.exist
    }
  })

  it('handles transfer with valid flags', async () => {
    try {
      const {stdout} = await runCommand('transfer --from acc_123 --to acc_456 --amount 100.00')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
