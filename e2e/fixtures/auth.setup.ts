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
 * @file Authentication Setup
 * @description Setup script for authenticated tests. Uses guest mode for E2E testing.
 *
 * To use authenticated tests:
 * 1. Run this setup first: bunx playwright test --project=setup
 * 2. Tests using storageState will have pre-authenticated sessions
 */

import { expect, test as setup } from '@playwright/test';

import { getTargetUrl } from './base';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup for E2E tests.
 *
 * This runs once before tests that require authentication.
 * Uses "Continue as Guest" flow for testing purposes.
 * The auth state is saved and reused across tests.
 */
setup('authenticate', async ({ page }) => {
  const targetUrl = getTargetUrl();

  // Navigate to guestbook page (where auth is typically needed)
  await page.goto(`${targetUrl}/guestbook`);
  await page.waitForLoadState('domcontentloaded');

  // Look for "Continue as Guest" or similar button
  const guestButton = page.locator(
    'button:has-text("guest"), button:has-text("Guest"), a:has-text("guest"), [data-guest]',
  );

  const hasGuestOption = (await guestButton.count()) > 0;

  if (hasGuestOption) {
    // Click the guest button
    await guestButton.first().click();
    await page.waitForTimeout(500);
  }

  // Alternatively, check if there's a guest sign-in option in a modal or dropdown
  const signInSection = page.locator('[class*="sign-in"], [class*="auth"], [data-auth]');
  if ((await signInSection.count()) > 0) {
    const guestLink = signInSection.locator('text=/guest|anonymous|skip/i').first();
    if ((await guestLink.count()) > 0) {
      await guestLink.click();
      await page.waitForTimeout(500);
    }
  }

  // Verify we're on the page and it loaded correctly
  const main = page.locator('main');
  await expect(main).toBeVisible();

  // Save storage state (cookies, localStorage) for reuse in other tests
  await page.context().storageState({ path: authFile });
});

/**
 * To use authenticated/guest state in tests:
 *
 * ```typescript
 * // In playwright.config.ts, add a project:
 * {
 *   name: 'authenticated',
 *   use: {
 *     storageState: 'playwright/.auth/user.json',
 *   },
 *   dependencies: ['setup'],
 * }
 *
 * // Or use directly in test file:
 * test.use({ storageState: 'playwright/.auth/user.json' });
 * ```
 */
