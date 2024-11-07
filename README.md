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
bank/0.0.0 darwin-arm64 node-v20.12.1
$ bank --help [COMMAND]
USAGE
  $ bank COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`bank accounts [ACCOUNT]`](#bank-accounts-account)
* [`bank settings ACTION [KEY] [VALUE]`](#bank-settings-action-key-value)
* [`bank transactions [TRANSACTION]`](#bank-transactions-transaction)

## `bank accounts [ACCOUNT]`

View account information

```
USAGE
  $ bank accounts [ACCOUNT] [-f json|csv|table] [-t <value>]

ARGUMENTS
  ACCOUNT  Account to filter

FLAGS
  -f, --format=<option>  Output format (json, csv, table)
                         <options: json|csv|table>
  -t, --type=<value>     Account type to filter (loan, checking, savings, etc.)

DESCRIPTION
  View account information

EXAMPLES
  $ bank accounts

  $ bank accounts --format csv

  $ bank accounts --type savings
```

_See code: [src/commands/accounts.ts](https://github.com/lab/bank/blob/v0.0.0/src/commands/accounts.ts)_

## `bank settings ACTION [KEY] [VALUE]`

Configure CLI preferences

```
USAGE
  $ bank settings ACTION [KEY] [VALUE]

ARGUMENTS
  ACTION  Action to perform (set, get, list, reset)
  KEY     Setting key
  VALUE   Value to set

DESCRIPTION
  Configure CLI preferences

EXAMPLES
  $ bank settings set api_key your_api_key

  $ bank settings get api_key

  $ bank settings list

  $ bank settings reset api_key
```

_See code: [src/commands/settings.ts](https://github.com/lab/bank/blob/v0.0.0/src/commands/settings.ts)_

## `bank transactions [TRANSACTION]`

Access transaction data

```
USAGE
  $ bank transactions [TRANSACTION] -s <value> -u <value> [-f json|csv|table] [-a <value>] [--minAmount <value>]
    [--maxAmount <value>] [-c <value>]

ARGUMENTS
  TRANSACTION  Transaction ID or description to filter

FLAGS
  -a, --account=<value>    Account ID to filter transactions
  -c, --category=<value>   Transaction category to filter
  -f, --format=<option>    Output format (json, csv, table)
                           <options: json|csv|table>
  -s, --since=<value>      (required) Start date for transactions (YYYY-MM-DD)
  -u, --until=<value>      (required) End date for transactions (YYYY-MM-DD)
      --maxAmount=<value>  Maximum transaction amount
      --minAmount=<value>  Minimum transaction amount

DESCRIPTION
  Access transaction data

EXAMPLES
  $ bank transactions

  $ bank transactions --since 2023-01-01 --until 2023-01-31

  $ bank transactions --minAmount 100 --maxAmount 500

  $ bank transactions --account acc_12345

  $ bank transactions --category "Groceries"
```

_See code: [src/commands/transactions.ts](https://github.com/lab/bank/blob/v0.0.0/src/commands/transactions.ts)_
<!-- commandsstop -->
