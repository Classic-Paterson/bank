# bank

Interact with your financial data directly from the command line using the Akahu API.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/bank.svg)](https://npmjs.org/package/bank)
[![Downloads/week](https://img.shields.io/npm/dw/bank.svg)](https://npmjs.org/package/bank)

<!-- toc -->
* [bank](#bank)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g bank
$ bank COMMAND
running command...
$ bank (--version)
bank/1.0.0 darwin-arm64 node-v20.17.0
$ bank --help [COMMAND]
USAGE
  $ bank COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`bank accounts [ACCOUNT]`](#bank-accounts-account)
* [`bank categories`](#bank-categories)
* [`bank categorise [MERCHANT]`](#bank-categorise-merchant)
* [`bank refresh`](#bank-refresh)
* [`bank settings ACTION [KEY] [VALUE]`](#bank-settings-action-key-value)
* [`bank sync`](#bank-sync)
* [`bank transactions [TRANSACTION]`](#bank-transactions-transaction)
* [`bank transfer`](#bank-transfer)

## `bank accounts [ACCOUNT]`

View account information

```
USAGE
  $ bank accounts [ACCOUNT] [-f json|csv|table] [-t <value>] [-d]

ARGUMENTS
  ACCOUNT  Account to filter

FLAGS
  -d, --details          Show detailed account info
  -f, --format=<option>  Output format (json, csv, table)
                         <options: json|csv|table>
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

## `bank categories`

Show spending by parent & detailed category over the last N months

```
USAGE
  $ bank categories [-m <value>] [-f json|csv|table]

FLAGS
  -f, --format=<option>  [default: table] Output format (json, csv, table)
                         <options: json|csv|table>
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
  $ bank transactions [TRANSACTION] [-a <value>] [-c <value>] [-f json|csv|table] [--maxAmount <value>]
    [--minAmount <value>] [-s <value>] [-u <value>] [-t <value>] [-p professional
    services|household|lifestyle|appearance|transport|food|housing|education|health|utilities] [-m <value>] [-d]

ARGUMENTS
  TRANSACTION  Transaction ID or description to filter

FLAGS
  -a, --account=<value>          Account ID to filter transactions
  -c, --category=<value>         Transaction category to filter
  -d, --details                  Show detailed transaction info
  -f, --format=<option>          Output format (json, csv, table)
                                 <options: json|csv|table>
  -m, --merchant=<value>         Merchant name to filter transactions
  -p, --parentCategory=<option>  Parent category to filter transactions
                                 <options: professional services|household|lifestyle|appearance|transport|food|housing|e
                                 ducation|health|utilities>
  -s, --since=<value>            Start date for transactions (YYYY-MM-DD)
  -t, --type=<value>             Transaction type to filter
  -u, --until=<value>            [default: 2025-05-26] End date for transactions (YYYY-MM-DD)
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
