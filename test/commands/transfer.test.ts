import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('transfer', () => {
  it('runs transfer cmd', async () => {
    const {stdout} = await runCommand('transfer')
    expect(stdout).to.contain('hello world')
  })

  it('runs transfer --name oclif', async () => {
    const {stdout} = await runCommand('transfer --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
