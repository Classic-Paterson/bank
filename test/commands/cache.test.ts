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

  it('shows help when no subcommand given', async () => {
    const {stdout} = await runCommand('cache')
    expect(stdout).to.contain('cache:clear')
    expect(stdout).to.contain('cache:info')
  })

  it('shows error for invalid subcommand', async () => {
    const {error} = await runCommand('cache invalid')
    expect(error).to.exist
    expect(error?.message).to.contain('Unknown subcommand')
  })
})
