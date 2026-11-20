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
 * @file The accessibility spec's own Playwright config (`bun run test:a11y`): axe and keyboard
 * checks over the routes of the 2026-11-20 WCAG 2.2 AA audit, at a 1440 x 900 desktop and a
 * 390 x 844 phone. See e2e/README.md, "Accessibility".
 *
 * It starts no server and has no default target. A11Y_BASE_URL names the server to check (a
 * local production build); unset, the config throws, so a run can never fall back to the dev
 * server on :3000 or reach the production site. The main config (playwright.config.ts) ignores
 * e2e/accessibility for the same reason.
 */

import { defineConfig, devices } from '@playwright/test';

/** The production site, which these checks never visit. */
const PRODUCTION_HOSTS: readonly string[] = ['mikeodnis.dev', 'www.mikeodnis.dev'];
/** The port of the owner's dev server, which these checks never use. */
const DEV_SERVER_PORT = '3000';

const USAGE =
  'Start a local production build (bun run build, then bunx next start -p <port>) and run ' +
  'A11Y_BASE_URL=http://127.0.0.1:<port> bun run test:a11y.';

/** The server to check, from A11Y_BASE_URL; throws when it is unset, unreadable or not allowed. */
function a11yBaseUrl(): string {
  const raw = process.env.A11Y_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      `A11Y_BASE_URL is not set. This config starts no server and has no default target. ${USAGE}`,
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`A11Y_BASE_URL is not a URL: ${raw}. ${USAGE}`);
  }
  if (PRODUCTION_HOSTS.includes(url.hostname)) {
    throw new Error(`A11Y_BASE_URL points at the production site (${url.host}). ${USAGE}`);
  }
  if (url.port === DEV_SERVER_PORT) {
    throw new Error(
      `A11Y_BASE_URL uses port ${DEV_SERVER_PORT}, the dev server's: check a production build on another port. ${USAGE}`,
    );
  }
  return url.origin;
}

export default defineConfig({
  testDir: './e2e/accessibility',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Two pages at a time keep a local production server responsive.
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Beside the main config's folders, not inside them: a main run clears its own report and results.
  reporter: [['list'], ['html', { outputFolder: 'playwright/a11y/reports', open: 'never' }]],
  outputDir: 'playwright/a11y/results',
  use: {
    baseURL: a11yBaseUrl(),
    // The axe source is injected with page.evaluate, which the site's nonce CSP would refuse.
    bypassCSP: true,
    colorScheme: 'dark',
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      // A Chromium phone (touch, mobile user agent) at the audit's 390 x 844.
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        screen: { width: 390, height: 844 },
      },
    },
  ],
});
