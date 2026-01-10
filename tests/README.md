# Test Structure

This project follows a **Vitest + Playwright** testing strategy optimized for Next.js 16.

## Directory Structure

```
tests/                    # Vitest tests (unit + integration)
├── unit/                 # Pure function tests, hooks, isolated components
│   └── utils/            # Utility function tests
├── integration/          # API client tests with mocked boundaries
│   └── api/              # API endpoint integration tests
├── setup/                # Test setup and configuration
│   ├── vitest.setup.ts   # Global Vitest setup
│   └── test-utils.tsx    # React testing utilities
├── fixtures/             # Shared test data and mocks
│   └── api-fixtures.ts   # API response mocks
└── README.md

e2e/                      # Playwright E2E tests
├── accessibility/        # WCAG accessibility tests
├── journeys/             # User journey tests (auth, navigation, critical flows)
├── performance/          # Performance and Core Web Vitals tests
├── seo/                  # SEO and meta tag tests
├── visual/               # Visual regression tests
├── fixtures/             # Playwright fixtures
│   ├── auth.setup.ts     # Authentication state setup (guest mode)
│   └── base.ts           # Extended test fixtures
└── README.md

playwright/               # Playwright state and artifacts
├── .auth/                # Stored authentication state (gitignored)
└── screenshots/          # Test screenshots
```

## Test Categories

### Unit Tests (Vitest)

- **Location**: `tests/unit/`
- **Purpose**: Pure logic (formatters, validation, data shaping)
- **Run**: `bun run test`

### Integration Tests (Vitest)

- **Location**: `tests/integration/`
- **Purpose**: API client tests with mocked external boundaries
- **Run**: `bun run test:integration`

### E2E Tests (Playwright)

- **Location**: `e2e/`
- **Purpose**: User journeys, cross-browser testing, accessibility, performance
- **Run**: `bun run test:e2e`

## Commands

```bash
# Run all Vitest tests (headless)
bun run test

# Run Vitest with UI (interactive dashboard)
bun run test:ui

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run tests in watch mode
bun run test:watch

# Run E2E tests (headless, default)
bun run test:e2e:headless

# Run E2E tests (headed, see browser)
bun run test:e2e

# Run E2E tests (Chromium only, faster for CI)
bun run e2e:ci

# Run E2E tests with Playwright UI
bun run e2e:ui
```

## Key Principles

1. **Vitest for fast feedback** - Unit and integration tests run in jsdom/node
2. **Vitest UI for debugging** - Interactive dashboard at http://localhost:51204/**vitest**/
3. **Playwright for real browsers** - E2E tests run in Chromium, Firefox, and WebKit
4. **Guest mode for auth** - E2E tests use "Continue as Guest" flow
5. **No Cypress** - We don't need two E2E frameworks; Playwright covers our cross-browser and SSO
   needs

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/utils/formatting.test.ts
import { describe, expect, it } from 'vitest';
import { formatDate } from '@/utils/date';

describe('formatDate', () => {
  it('formats ISO date to readable string', () => {
    expect(formatDate('2025-01-08')).toBe('January 8, 2025');
  });
});
```

### Integration Test Example

```typescript
// tests/integration/api/spotify.test.ts
import { describe, expect, it, vi } from 'vitest';
import { testApiEndpoint } from '@/tests/fixtures/api-fixtures';

describe('Spotify API', () => {
  it('returns now-playing track', async () => {
    const result = await testApiEndpoint('/api/v1/now-playing');
    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.status).toBeLessThan(500);
  });
});
```

### E2E Test Example

```typescript
// e2e/journeys/navigation.spec.ts
import { expect, test } from '@playwright/test';

test('user can navigate through main sections', async ({ page }) => {
  await page.goto('/');
  await page.click('text=About');
  await expect(page).toHaveURL(/\/about/);
});
```

## Notes

- **Async Server Components**: Per Next.js docs, use E2E tests for async Server Components
- **Authentication**: Use Playwright's `storageState` for reusable auth state
- **CI**: E2E runs on Chromium only in CI for speed; full browser matrix in nightly builds
