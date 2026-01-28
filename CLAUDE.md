# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CLI application called `bank` that provides a command-line interface to interact with financial data through the Akahu API. It allows users to view accounts, query transactions, categorize spending, initiate transfers, and sync data to Google Sheets.

## Technology Stack

- **Framework**: oclif (CLI framework)
- **Language**: TypeScript (ESNext modules)
- **API**: Akahu Node.js SDK
- **Testing**: Mocha + Chai
- **Linting**: ESLint with oclif configs

## Build & Development Commands

```bash
# Build the project (required after TypeScript changes)
npm run build

# Run CLI locally during development
./bin/dev.js [command]

# Link CLI globally for testing
npm run link-local

# Unlink global CLI
npm run unlink-local

# Run tests
npm test

# Run linter
npm run lint

# Generate documentation and manifest
npm run docs

# Run a single test file
npx mocha --forbid-only "test/path/to/file.test.ts"
```

## Architecture Overview

### Service Layer Pattern

The codebase follows a service-oriented architecture with singleton service instances:

- **ApiService** (`src/services/api.service.ts`): Handles all Akahu API interactions (accounts, transactions, transfers, refresh)
- **ConfigService** (`src/services/config.service.ts`): Manages user configuration stored in `~/.bankcli/config.json`
- **MerchantMappingService** (`src/services/merchant-mapping.service.ts`): Manages merchant-to-category mappings in `~/.bankcli/merchant_map.json`
- **TransactionProcessingService** (`src/services/transaction-processing.service.ts`): Handles transaction formatting, filtering, and analysis
- **CacheService** (`src/services/cache.service.ts`): Optional transaction caching
- **GoogleSheetsService** (`src/services/google-sheets.service.ts`): OAuth2-based Google Sheets integration

Services are exported as singletons (e.g., `export const apiService = new ApiService()`).

### Commands Structure

Commands are in `src/commands/` and extend oclif's `Command` class:

- `accounts.ts` - View account information
- `transactions.ts` - Query and filter transactions
- `categories.ts` - Analyze spending by category over time
- `categorise.ts` - Interactive merchant categorization
- `transfer.ts` - Initiate funds transfers with safety features
- `refresh.ts` - Trigger Akahu data refresh
- `sync.ts` - Sync transactions to Google Sheets
- `settings.ts` - Manage CLI configuration

### Configuration Management

User settings are stored in `~/.bankcli/config.json` and managed by ConfigService. Key settings include:

- `appToken` - Akahu app token (required)
- `userToken` - Akahu user token (required)
- `format` - Default output format (json/csv/table/ndjson)
- `cacheData` - Enable transaction caching
- `transferAllowlist` - Array of allowed destination accounts for transfers

### Type System

Type definitions are centralized in `src/types/index.ts`:

- `AppConfig` - Configuration shape
- `FormattedTransaction` - Display-ready transaction format
- `TransactionFilter` - Transaction query filters
- `MerchantMap` - Merchant-to-category mapping
- `AccountSummary` - Account display format

The codebase uses Akahu SDK types (`Account`, `EnrichedTransaction`, etc.) for raw API data.

### Output Formatting

The `src/utils/output.ts` module handles multi-format output:
- **json**: Pretty-printed JSON
- **csv**: CSV with headers
- **table**: CLI table rendering
- **ndjson**: Newline-delimited JSON (one object per line)

Commands accept a `--format` flag that defaults to the user's configured format.

### Transaction Processing

Transaction processing follows this flow:
1. **Fetch** via ApiService from Akahu API
2. **Format** via TransactionProcessingService (maps raw API data to `FormattedTransaction`)
3. **Filter** via TransactionProcessingService (applies user filters)
4. **Display** via output.ts (renders in requested format)

### Security Features

The transfer command includes multiple safety layers:
- Required `--confirm` or `--dry-run` flags
- Interactive confirmation prompt
- Transfer summary with masked account details
- Optional allowlist of destination accounts
- Data masking in logs and errors

## Key Constants

Defined in `src/constants/index.ts`:

- **CONFIG_DIR_NAME**: `.bankcli` (user config directory)
- **PARENT_CATEGORIES**: Valid spending categories
- **EXCLUDED_TRANSACTION_TYPES**: Types excluded from spending analysis (e.g., 'TRANSFER')
- **DEFAULT_TRANSACTION_DAYS_BACK**: Default lookback period

## Testing

Tests are located in `test/` and use Mocha + Chai. The test suite includes:
- Command execution tests
- Output format validation
- Configuration management tests

Run tests with `npm test` (includes linting via `posttest` hook).

## Build Process

The build process:
1. Clears `dist/` and `tsconfig.tsbuildinfo`
2. Compiles TypeScript with `tsc -b` (composite mode)
3. Output goes to `dist/` matching `src/` structure
4. The `prepack` hook generates the oclif manifest

## Module System

This project uses **ES modules** (`"type": "module"` in package.json):
- Import statements require `.js` extensions (even for `.ts` source files)
- All imports use `.js` extension: `import { foo } from './bar.js'`
- No `require()` or CommonJS syntax

## API Integration

The Akahu API client is initialized with:
- `appToken` from config (required)
- `userToken` from config (required)

All API calls are centralized in ApiService, which provides:
- `listAccounts()` - Fetch all accounts
- `listTransactions(params)` - Fetch transactions with optional filters
- `listAllTransactions(start, end)` - Fetch all transactions in date range (includes pagination)
- `refreshUserData()` - Trigger account data refresh
- `initiateTransfer(params)` - Create transfer
- `getTransferStatus(id)` - Check transfer status

## Common Patterns

### Adding a new command

1. Create `src/commands/your-command.ts` extending `Command`
2. Define flags using `@oclif/core` decorators
3. Use services (don't duplicate logic)
4. Support output formats via `output.ts`
5. Add tests in `test/commands/your-command.test.ts`
6. Run `npm run docs` to update README

### Adding a new service

1. Create class in `src/services/`
2. Export singleton instance: `export const yourService = new YourService()`
3. Add types to `src/types/index.ts`
4. Import and use in commands

### Working with transactions

```typescript
import { apiService } from '../services/api.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';

// Fetch transactions
const raw = await apiService.listTransactions({ startDate: '2024-01-01' });

// Format for display
const formatted = transactionProcessingService.formatTransactions(raw, accounts);

// Apply filters
const filtered = transactionProcessingService.applyFilters(formatted, filters);

// Output
await outputData(filtered, format);
```

## OAuth2 Flow (Google Sheets)

The `sync` command uses OAuth2 User Account flow:
1. Client secret JSON file required (via `--oauthClientKey` or env var)
2. Tokens cached in `~/.bankcli/.bank-oauth-tokens.json`
3. First run triggers browser-based auth flow
4. Subsequent runs reuse refresh token
