import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('cache', () => {
  it('runs cache info command', async () => {
    const {stdout} = await runCommand('cache info')
    expect(stdout).to.contain('Cache Status:')
  })

  it('runs cache clear command', async () => {
    const {stdout} = await runCommand('cache clear -y')
    expect(stdout).to.contain('Cleared all cached data.')
  })

  it('runs cache clear with --accounts flag', async () => {
    const {stdout} = await runCommand('cache clear --accounts -y')
    expect(stdout).to.contain('Cleared account cache.')
  })

  it('runs cache clear with --transactions flag', async () => {
    const {stdout} = await runCommand('cache clear --transactions -y')
    expect(stdout).to.contain('Cleared transaction cache.')
  })

  it('rejects invalid action', async () => {
    const {error} = await runCommand('cache invalid')
    expect(error).to.exist
    expect(error?.message).to.contain('Expected invalid to be one of: clear, info')
  })

  it('requires an action argument', async () => {
    const {error} = await runCommand('cache')
    expect(error).to.exist
    expect(error?.message).to.contain('Missing 1 required arg')
  })
})
