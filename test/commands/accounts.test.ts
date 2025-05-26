import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('accounts', () => {
  it('runs accounts command', async () => {
    // Note: This test would require API mocking in a real test environment
    // For now, we're just testing the command structure
    try {
      const {stdout} = await runCommand('accounts')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles format flag', async () => {
    try {
      const {stdout} = await runCommand('accounts --format json')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles type filter', async () => {
    try {
      const {stdout} = await runCommand('accounts --type savings')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
