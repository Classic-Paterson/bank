# bank

Interact with your financial data directly from the command line using the Akahu API.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/bank.svg)](https://npmjs.org/package/bank)
[![Downloads/week](https://img.shields.io/npm/dw/bank.svg)](https://npmjs.org/package/bank)

<!-- toc -->

- [bank](#bank)
- [Usage](#usage)
- [Post-install](#post-install)
- [For zsh (most macOS users)](#for-zsh-most-macos-users)
- [For bash](#for-bash)
- [For PowerShell](#for-powershell)
- [Output accounts as NDJSON for processing with jq](#output-accounts-as-ndjson-for-processing-with-jq)
- [Stream transactions to a file for processing](#stream-transactions-to-a-file-for-processing)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g bank
$ bank COMMAND
running command...
$ bank (--version)
bank/1.0.0 darwin-arm64 node-v22.14.0
$ bank --help [COMMAND]
USAGE
  $ bank COMMAND
...
```

<!-- usagestop -->

# Post-install

## Shell Autocomplete

Enable tab completion for commands and flags by setting up shell autocomplete:

```bash
# For zsh (most macOS users)
bank autocomplete zsh

# For bash
bank autocomplete bash

# For PowerShell
bank autocomplete powershell
```

Follow the instructions displayed by the autocomplete command to add the completion script to your shell configuration. Once configured, you can use tab completion for:

- Command names (e.g., `bank tr<TAB>` → `bank transactions`)
- Flag names (e.g., `bank transactions --f<TAB>` → `bank transactions --format`)
- Flag values for supported flags

To refresh the autocomplete cache after updating the CLI:

```bash
bank autocomplete --refresh-cache
```

## Output Formats

This application supports multiple output formats for displaying data:

- **json**: Pretty-printed JSON format for human readability
- **csv**: Comma-separated values format for spreadsheet import
- **table**: Formatted table display for terminal viewing (default for most commands)
- **list**: Simple list format for terminal viewing
- **ndjson**: Newline Delimited JSON format - each object on a separate line as compact JSON

The NDJSON format is particularly useful for:

- Streaming data processing
- Integration with tools that process line-by-line JSON (like `jq`)
- Machine parsing where each record should be processed independently
- Log aggregation systems

Example usage:

```bash
# Output accounts as NDJSON for processing with jq
bank accounts --format ndjson | jq '.name'

# Stream transactions to a file for processing
bank transactions --format ndjson > transactions.ndjson
```

# Commands

<!-- commands -->

- [`bank accounts [ACCOUNT]`](#bank-accounts-account)
- [`bank autocomplete [SHELL]`](#bank-autocomplete-shell)
- [`bank categories`](#bank-categories)
- [`bank categorise [MERCHANT]`](#bank-categorise-merchant)
- [`bank help [COMMAND]`](#bank-help-command)
- [`bank plugins`](#bank-plugins)
- [`bank plugins:add PLUGIN`](#bank-pluginsadd-plugin)
- [`bank plugins:inspect PLUGIN...`](#bank-pluginsinspect-plugin)
- [`bank plugins:install PLUGIN`](#bank-pluginsinstall-plugin)
- [`bank plugins:link PATH`](#bank-pluginslink-path)
- [`bank plugins:remove [PLUGIN]`](#bank-pluginsremove-plugin)
- [`bank plugins:reset`](#bank-pluginsreset)
- [`bank plugins:uninstall [PLUGIN]`](#bank-pluginsuninstall-plugin)
- [`bank plugins:unlink [PLUGIN]`](#bank-pluginsunlink-plugin)
- [`bank plugins:update`](#bank-pluginsupdate)
- [`bank refresh`](#bank-refresh)
- [`bank settings ACTION [KEY] [VALUE]`](#bank-settings-action-key-value)
- [`bank sync`](#bank-sync)
- [`bank transactions [TRANSACTION]`](#bank-transactions-transaction)
- [`bank transfer`](#bank-transfer)

## `bank accounts [ACCOUNT]`

View account information

```
USAGE
  $ bank accounts [ACCOUNT] [-f json|csv|table|list|ndjson] [-t <value>] [-d]

ARGUMENTS
  ACCOUNT  Account to filter

FLAGS
  -d, --details          Show detailed account info
  -f, --format=<option>  Output format (json, csv, table, list, ndjson)
                         <options: json|csv|table|list|ndjson>
  -t, --type=<value>     Account type to filter (loan, checking, savings, etc.)

DESCRIPTION
  View account information

EXAMPLES
  $ bank accounts

  $ bank accounts --format csv

  $ bank accounts --type savings

  $ bank accounts --details
```

_See code: [src/commands/accounts.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/accounts.ts)_

## `bank autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ bank autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ bank autocomplete

  $ bank autocomplete bash

  $ bank autocomplete zsh

  $ bank autocomplete powershell

  $ bank autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.2.34/src/commands/autocomplete/index.ts)_

## `bank categories`

Show spending by parent & detailed category over the last N months

```
USAGE
  $ bank categories [-m <value>] [-f json|csv|table|list|ndjson]

FLAGS
  -f, --format=<option>  [default: table] Output format (json, csv, table, list, ndjson)
                         <options: json|csv|table|list|ndjson>
  -m, --months=<value>   [default: 6] Number of months to include (starting with current month)

DESCRIPTION
  Show spending by parent & detailed category over the last N months

EXAMPLES
  $ bank categories -m 6

  $ bank categories -m 3 -f csv
```

_See code: [src/commands/categories.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/categories.ts)_

## `bank categorise [MERCHANT]`

Interactively assign categories to uncategorised transactions and store a merchant map

```
USAGE
  $ bank categorise [MERCHANT] [-s <value>] [-u <value>] [-l <value>]

ARGUMENTS
  MERCHANT  Force categorise only transactions whose merchant includes this string

FLAGS
  -l, --limit=<value>  Maximum number of transactions to process
  -s, --since=<value>  Start date (YYYY-MM-DD) to scan for uncategorised transactions
  -u, --until=<value>  End date (YYYY-MM-DD); defaults to today

DESCRIPTION
  Interactively assign categories to uncategorised transactions and store a merchant map

EXAMPLES
  $ bank categorise --since 2024-01-01

  $ bank categorise --limit 20
```

_See code: [src/commands/categorise.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/categorise.ts)_

## `bank help [COMMAND]`

Display help for bank.

```
USAGE
  $ bank help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for bank.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.28/src/commands/help.ts)_

## `bank plugins`

List installed plugins.

```
USAGE
  $ bank plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ bank plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/index.ts)_

## `bank plugins:add PLUGIN`

Installs a plugin into bank.

```
USAGE
  $ bank plugins:add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into bank.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the BANK_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the BANK_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ bank plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ bank plugins:add myplugin

  Install a plugin from a github url.

    $ bank plugins:add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ bank plugins:add someuser/someplugin
```

## `bank plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ bank plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ bank plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/inspect.ts)_

## `bank plugins:install PLUGIN`

Installs a plugin into bank.

```
USAGE
  $ bank plugins:install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into bank.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the BANK_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the BANK_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ bank plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ bank plugins:install myplugin

  Install a plugin from a github url.

    $ bank plugins:install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ bank plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/install.ts)_

## `bank plugins:link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ bank plugins:link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ bank plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/link.ts)_

## `bank plugins:remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ bank plugins:remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ bank plugins:unlink
  $ bank plugins:remove

EXAMPLES
  $ bank plugins:remove myplugin
```

## `bank plugins:reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ bank plugins:reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/reset.ts)_

## `bank plugins:uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ bank plugins:uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ bank plugins:unlink
  $ bank plugins:remove

EXAMPLES
  $ bank plugins:uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/uninstall.ts)_

## `bank plugins:unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ bank plugins:unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ bank plugins:unlink
  $ bank plugins:remove

EXAMPLES
  $ bank plugins:unlink myplugin
```

## `bank plugins:update`

Update installed plugins.

```
USAGE
  $ bank plugins:update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.15/src/commands/plugins/update.ts)_

## `bank refresh`

Trigger a data refresh for all linked accounts

```
USAGE
  $ bank refresh

DESCRIPTION
  Trigger a data refresh for all linked accounts

EXAMPLES
  $ bank refresh
```

_See code: [src/commands/refresh.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/refresh.ts)_

## `bank settings ACTION [KEY] [VALUE]`

Configure CLI preferences

```
USAGE
  $ bank settings ACTION [KEY] [VALUE] [-h]

ARGUMENTS
  ACTION  (set|get|list|reset) Action to perform (set, get, list, reset)
  KEY     (api_key|app_token|format|cacheData) Setting key
  VALUE   Value to set

FLAGS
  -h, --help  Show available settings

DESCRIPTION
  Configure CLI preferences

EXAMPLES
  $ bank settings list

  $ bank settings set api_key your_api_key

  $ bank settings set format table

  $ bank settings set cacheData true

  $ bank settings get api_key

  $ bank settings reset api_key

  $ bank settings --help
```

_See code: [src/commands/settings.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/settings.ts)_

## `bank sync`

Sync CSV transaction data to a Google Sheets spreadsheet using OAuth2 (User Account)

```
USAGE
  $ bank sync [-s <value>] [-o <value>]

FLAGS
  -o, --oauthClientKey=<value>  [default: /Users/reecepaterson/.bankcli/client_secret.json] Path to the OAuth2 client
                                secret JSON file (uses GOOGLE_OAUTH_CLIENT_KEY env var if not set)
  -s, --sheetId=<value>         ID of the Google Sheet to sync to (creates one if not provided)

DESCRIPTION
  Sync CSV transaction data to a Google Sheets spreadsheet using OAuth2 (User Account)

EXAMPLES
  $ bank transactions -f csv | bank sync --sheetId <YOUR_SHEET_ID> --oauthClientKey /path/to/client_secret.json

  $ bank transactions -f csv | bank sync --oauthClientKey /path/to/client_secret.json  # (creates a new sheet if none specified)
```

_See code: [src/commands/sync.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/sync.ts)_

## `bank transactions [TRANSACTION]`

Access transaction data

```
USAGE
  $ bank transactions [TRANSACTION] [-a <value>] [-c <value>] [-f json|csv|table|list|ndjson] [--maxAmount
    <value>] [--minAmount <value>] [-s <value>] [-u <value>] [-t <value>] [-p professional
    services|household|lifestyle|appearance|transport|food|housing|education|health|utilities] [-m <value>] [-d]

ARGUMENTS
  TRANSACTION  Transaction ID or description to filter

FLAGS
  -a, --account=<value>          Account ID to filter transactions
  -c, --category=<value>         Transaction category to filter
  -d, --details                  Show detailed transaction info
  -f, --format=<option>          Output format (json, csv, table, list, ndjson)
                                 <options: json|csv|table|list|ndjson>
  -m, --merchant=<value>         Merchant name to filter transactions
  -p, --parentCategory=<option>  Parent category to filter transactions
                                 <options: professional services|household|lifestyle|appearance|transport|food|housing|e
                                 ducation|health|utilities>
  -s, --since=<value>            Start date for transactions (YYYY-MM-DD)
  -t, --type=<value>             Transaction type to filter
  -u, --until=<value>            [default: 2025-08-25] End date for transactions (YYYY-MM-DD)
      --maxAmount=<value>        Maximum transaction amount
      --minAmount=<value>        Minimum transaction amount

DESCRIPTION
  Access transaction data

EXAMPLES
  $ bank transactions

  $ bank transactions --since 2023-01-01 --until 2023-01-31

  $ bank transactions --minAmount 100 --maxAmount 500

  $ bank transactions --account acc_12345

  $ bank transactions --category "Groceries"

  $ bank transactions --type "TRANSFER"

  $ bank transactions --parentCategory "Utilities"

  $ bank transactions --merchant "Amazon"

  $ bank transactions --parentCategory "Groceries" --merchant "Whole Foods"
```

_See code: [src/commands/transactions.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/transactions.ts)_

## `bank transfer`

Initiate a funds transfer

```
USAGE
  $ bank transfer -f <value> -t <value> -a <value> [-d <value>] [-r <value>]

FLAGS
  -a, --amount=<value>       (required) Amount to transfer (in NZD)
  -d, --description=<value>  Transfer description
  -f, --from=<value>         (required) Source account ID or name
  -r, --reference=<value>    Transfer reference
  -t, --to=<value>           (required) Destination account number (e.g., 12-3456-7890123-00)

DESCRIPTION
  Initiate a funds transfer

EXAMPLES
  $ bank transfer --from "Everyday Checking" --to 12-3456-7890123-00 --amount 100.00

  $ bank transfer --from acc_12345 --to 12-3456-7890123-00 --amount 100.00 --description "Payment for services" --reference "Invoice 123"
```

_See code: [src/commands/transfer.ts](https://github.com/lab/bank/blob/v1.0.0/src/commands/transfer.ts)_

<!-- commandsstop -->
