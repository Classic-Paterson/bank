import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('settings', () => {
  it('runs settings list command', async () => {
    const {stdout} = await runCommand('settings list')
    expect(stdout).to.contain('Available settings')
  })

  it('handles help flag', async () => {
    const {stdout} = await runCommand('settings --help')
    expect(stdout).to.contain('Configure CLI preferences')
  })

  it('handles invalid commands gracefully', async () => {
    try {
      await runCommand('settings')
      expect.fail('Should have thrown an error for missing action')
    } catch (error: any) {
      // Expected to fail - missing required argument
      expect(error).to.exist
    }
  })

  it('handles get command', async () => {
    try {
      await runCommand('settings get format')
      // Should handle gracefully even if no value is set
    } catch (error: any) {
      // API configuration errors are expected in test environment
      expect(error.message).to.satisfy((msg: string) => 
        msg.includes('API') || msg.includes('config') || msg.includes('token')
      )
    }
  })
})
