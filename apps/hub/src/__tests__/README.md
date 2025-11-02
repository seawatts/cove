# Hub V2 Integration Tests

End-to-end integration tests for the Hub V2 daemon using Bun's native test runner.

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/__tests__/daemon-lifecycle.test.ts

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

## Test Structure

- **setup.ts** - Global test setup, database helpers, and environment configuration
- **helpers.ts** - Test helper functions for database verification and HTTP requests
- **factories.ts** - Test data factories for creating mock devices, entities, and credentials
- **daemon-helpers.ts** - Helper functions specific to daemon lifecycle management
- **daemon-lifecycle.test.ts** - Tests for daemon initialization, running state, and shutdown
- **device-discovery.test.ts** - Tests for device discovery and pairing workflows

## Mock ESPHome Driver

Located in `src/drivers/__mocks__/esphome-mock.ts`, this implements a full Driver interface for testing purposes without requiring actual ESPHome hardware.

## Test Database

Tests use in-memory SQLite databases (`:memory:`) for speed and isolation. Each test gets a fresh database instance with all tables properly initialized.

## Key Features

- **Isolated** - Each test has its own database instance
- **Fast** - In-memory SQLite with no network calls
- **Comprehensive** - Tests cover initialization, discovery, pairing, commands, and telemetry
- **Mock-based** - Uses mock ESPHome driver for realistic but controllable testing

