# QVM Testing Suite

This directory contains the comprehensive testing suite.

## Structure

- `unit/`: Unit tests for individual utility modules.
- `integration/`: Integration tests for API routes and background workers.
- `setup.js`: Global Vitest setup and environment configuration.

## Running Tests

To run all tests:
```bash
npm test
```

To run tests with coverage:
```bash
npm run test:coverage
```

To run a specific test file:
```bash
npx vitest tests/unit/utility/config.test.js
```

## Adding New Tests

1. Create a new `.test.js` file in the appropriate directory.
2. Use `vi.mock()` for any external dependencies (APIs, databases, etc.).
3. Follow the existing patterns in current tests.

## Environment Variables

Tests use `.env.test` for configuration.