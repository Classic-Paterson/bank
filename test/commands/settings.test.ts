import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('settings', () => {
  it('runs settings cmd', async () => {
    const {stdout} = await runCommand('settings')
    expect(stdout).to.contain('hello world')
  })

  it('runs settings --name oclif', async () => {
    const {stdout} = await runCommand('settings --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
