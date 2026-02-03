import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('categorise', () => {
  // Note: The categorise command uses inquirer for interactive prompts,
  // which can cause tests to hang. We test via --help to verify command
  // registration and flag parsing without triggering interactive prompts.

  it('handles help flag', async () => {
    const {stdout} = await runCommand('categorise --help')
    expect(stdout).to.include('Interactively assign categories')
    expect(stdout).to.include('--since')
    expect(stdout).to.include('--until')
    expect(stdout).to.include('--limit')
  })

  it('shows examples in help', async () => {
    const {stdout} = await runCommand('categorise --help')
    expect(stdout).to.include('EXAMPLES')
    expect(stdout).to.include('bank categorise')
  })

  it('shows flag descriptions in help', async () => {
    const {stdout} = await runCommand('categorise --help')
    expect(stdout).to.include('Start date')
    expect(stdout).to.include('End date')
    expect(stdout).to.include('Maximum number of transactions')
  })

  it('shows merchant argument in help', async () => {
    const {stdout} = await runCommand('categorise --help')
    expect(stdout).to.include('ARGUMENTS')
    expect(stdout).to.include('merchant')
  })
})
