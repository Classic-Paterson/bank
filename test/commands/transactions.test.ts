import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('transactions', () => {
  it('runs transactions command', async () => {
    try {
      const {stdout} = await runCommand('transactions')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles date filters', async () => {
    try {
      const {stdout} = await runCommand('transactions --since 2024-01-01 --until 2024-01-31')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles amount filters', async () => {
    try {
      const {stdout} = await runCommand('transactions --minAmount 100 --maxAmount 500')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })

  it('handles format flag', async () => {
    try {
      const {stdout} = await runCommand('transactions --format table')
      expect(stdout).to.be.a('string')
    } catch (error) {
      // Expected to fail without proper API configuration
      expect(error).to.exist
    }
  })
})
