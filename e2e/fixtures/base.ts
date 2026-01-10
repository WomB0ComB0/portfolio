/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Extended Playwright Test Fixtures
 * @description Custom fixtures for E2E testing including authenticated pages.
 */

import {
  test as base,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
} from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Extended test options with custom fixtures.
 */
type CustomTestOptions = PlaywrightTestArgs &
  PlaywrightTestOptions & {
    /**
     * A page that automatically navigates based on the test file name.
     */
    autoNavigatePage: Page;
  };

/**
 * Extended test with custom fixtures.
 *
 * @example
 * import { test, expect } from '@/e2e/fixtures/base';
 *
 * test('my test', async ({ page }) => {
 *   await page.goto('/');
 *   await expect(page).toHaveTitle(/Portfolio/);
 * });
 */
export const test = base.extend<CustomTestOptions>({
  /**
   * A page fixture that automatically navigates to a URL based on the test file name.
   * Useful for page-specific test files.
   */
  autoNavigatePage: async ({ baseURL, page }, use, testInfo) => {
    const testFilePath = testInfo.titlePath[0] || '';
    const fileName = testFilePath.replace('.spec.ts', '');
    const url = `${baseURL}${fileName}`;

    await page.goto(url);
    await use(page);
  },
});

/**
 * Get the target URL for E2E tests.
 * Always uses localhost for local testing, regardless of env vars.
 */
export function getTargetUrl(): string {
  // For E2E tests, always use localhost to match Playwright's webServer config
  // This prevents tests from accidentally hitting production
  return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000';
}

/**
 * Get the base URL for E2E tests (local or production).
 */
export function getBaseUrl(): string {
  return getTargetUrl();
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Check if running locally (development)
 */
export function isLocal(): boolean {
  return !process.env.CI;
}

/**
 * Environment-aware timeout configuration.
 * Local development is more lenient due to dev server overhead and parallel test execution.
 */
export const TIMEOUTS = {
  /** Navigation timeout for page.goto() */
  navigation: isCI() ? 30_000 : 60_000,
  /** Action timeout for clicks, fills, etc. */
  action: isCI() ? 10_000 : 30_000,
  /** Expect/assertion timeout */
  expect: isCI() ? 5_000 : 15_000,
  /** Page reload timeout */
  reload: isCI() ? 30_000 : 60_000,
} as const;

/**
 * Environment-aware performance thresholds.
 * Local development is more lenient due to dev server overhead.
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Page load time (DOMContentLoaded) */
  pageLoad: isCI() ? 8_000 : 45_000,
  /** Time to interactive (networkidle) */
  interactive: isCI() ? 15_000 : 60_000,
  /** DOM ready time */
  domReady: isCI() ? 5_000 : 25_000,
  /** First Contentful Paint */
  fcp: isCI() ? 5_000 : 15_000,
  /** Largest Contentful Paint */
  lcp: isCI() ? 6_000 : 20_000,
  /** Network request limit */
  maxRequests: isCI() ? 100 : 200,
  /** CSS file size (KB) */
  maxCssSize: 500,
  /** Critical resource load time */
  criticalResource: isCI() ? 3_000 : 10_000,
} as const;

/**
 * Get a timeout multiplier for the current environment.
 * Local development gets more generous timeouts.
 */
export function getTimeoutMultiplier(): number {
  return isCI() ? 1 : 2.5;
}
