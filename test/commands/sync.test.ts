import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('sync', () => {
  // Note: Tests that invoke sync without --help will hang waiting for stdin
  // in test environments where stdin is not a TTY but has no data.
  // We test via --help to verify command registration and flag parsing.

  it('handles help flag', async () => {
    const {stdout} = await runCommand('sync --help')
    expect(stdout).to.include('Sync CSV transaction data to a Google Sheets spreadsheet')
    expect(stdout).to.include('--sheetId')
    expect(stdout).to.include('--oauthClientKey')
  })

  it('shows examples in help', async () => {
    const {stdout} = await runCommand('sync --help')
    expect(stdout).to.include('EXAMPLES')
    expect(stdout).to.include('bank transactions -f csv')
  })

  it('shows flag descriptions in help', async () => {
    const {stdout} = await runCommand('sync --help')
    expect(stdout).to.include('ID of the Google Sheet')
    expect(stdout).to.include('OAuth2 client secret')
  })
})
