Interact with your financial data directly from the command line using the Akahu API.

USAGE
$ bank [COMMAND] [OPTIONS]

COMMANDS
accounts View account information
transactions Access transaction data
transfer Initiate transfers between accounts
settings Configure CLI preferences
help Display help information about bank commands

GLOBAL FLAGS
-h, --help Show CLI help
-v, --version Show the CLI version
-f, --format Output format (json, csv, table) [default: json]
-q, --quiet Suppress non-error messages

EXAMPLES

$ bank accounts
Lists all your accounts.

$ bank transactions --since 2023-01-01 --until 2023-01-31
Lists transactions between specified dates.

$ bank transfer --from acc_123 --to 12-3456-7890123-00 --amount 250.00
Initiates a transfer of $250.00 from your account to an external account.

$ bank settings set format csv
Sets the default output format to CSV.

For more information on a specific command, run:

$ bank [COMMAND] --help
