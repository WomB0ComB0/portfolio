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

import { defineConfig, devices } from '@playwright/test';

/**
 * Check if running in CI environment
 */
const isCI = !!process.env.CI;

/**
 * Get browser projects based on environment.
 * CI runs all browsers; local development defaults to Chromium-based browsers only
 * (Firefox/WebKit often require additional system dependencies on Linux).
 */
function getBrowserProjects() {
  // Core Chromium-based browsers (work reliably across environments)
  const chromiumProjects = [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ];

  // Additional browsers for CI (requires system dependencies)
  const additionalBrowsers = [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ];

  // In CI, run all browsers; locally, skip webkit/firefox unless explicitly requested
  const runAllBrowsers = isCI || process.env.PLAYWRIGHT_ALL_BROWSERS === 'true';

  return [...chromiumProjects, ...(runAllBrowsers ? additionalBrowsers : [])];
}

/**
 * Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Use new e2e/ directory structure
  testDir: './e2e',
  // Ignore setup files (auth is optional, tests work without it)
  testIgnore: ['**/fixtures/**'],
  // Run tests in files in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Limit workers: CI uses 1 worker for stability, local uses 4 to prevent server overload
  workers: process.env.CI ? 1 : 4,
  // Default timeout (generous for local dev)
  timeout: isCI ? 30_000 : 60_000,
  // Expect timeout
  expect: {
    timeout: isCI ? 5_000 : 15_000,
  },
  // Reporter configuration
  reporter: [['html', { outputFolder: 'playwright/reports' }], ['list']],
  // Output directory for screenshots and traces
  outputDir: 'playwright/results',
  // Shared settings for all projects
  use: {
    // Base URL for local dev server
    baseURL: 'http://127.0.0.1:3000',
    // Navigation timeout (generous for dev server cold starts)
    navigationTimeout: isCI ? 30_000 : 60_000,
    // Action timeout
    actionTimeout: isCI ? 10_000 : 30_000,
    // Collect trace when retrying failed tests
    trace: 'on-first-retry',
    // Screenshot on failure
    screenshot: 'only-on-failure',
    // Video on failure
    video: 'retain-on-failure',
    // Run headless by default (use --headed flag for headed mode)
    headless: true,
  },

  // Configure projects for major browsers (environment-aware)
  projects: getBrowserProjects(),

  // Run local dev server before starting tests
  webServer: {
    command: 'bun run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
});
