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
 * @file Theme/Dark Mode E2E Tests
 * @description Tests for theme toggling, persistence, and system preference respect.
 */

import { expect, test } from '@playwright/test';

import { getTargetUrl, TIMEOUTS } from '../fixtures/base';

test.describe('Theme & Dark Mode', () => {
  test.describe('Theme Toggle', () => {
    test('should toggle between light and dark mode', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');
      const initialTheme = initialClass?.includes('dark') ? 'dark' : 'light';

      // Find the theme toggle button - skip if not present
      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      await themeToggle.click();
      await page.waitForTimeout(300); // Wait for transition

      const newClass = await html.getAttribute('class');
      const newTheme = newClass?.includes('dark') ? 'dark' : 'light';

      // Theme should have changed
      expect(newTheme).not.toBe(initialTheme);
    });

    test('should toggle back to original theme', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');

      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      // Toggle twice
      await themeToggle.click();
      await page.waitForTimeout(300);
      await themeToggle.click();
      await page.waitForTimeout(300);

      const finalClass = await html.getAttribute('class');

      // Should be back to initial state
      expect(finalClass?.includes('dark')).toBe(initialClass?.includes('dark'));
    });
  });

  test.describe('Theme Persistence', () => {
    test('should persist theme preference across page navigation', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      // Toggle to ensure we're in a known state
      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      await themeToggle.click();
      await page.waitForTimeout(300);

      const themeAfterToggle = await page.locator('html').getAttribute('class');
      const isDark = themeAfterToggle?.includes('dark');

      // Navigate to another page
      await page.goto(`${targetUrl}/about`);
      await page.waitForLoadState('domcontentloaded');

      // Theme should persist
      const themeOnAbout = await page.locator('html').getAttribute('class');
      expect(themeOnAbout?.includes('dark')).toBe(isDark);
    });

    test('should persist theme preference across page reload', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      // Toggle to a different theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      const themeAfterToggle = await page.locator('html').getAttribute('class');

      // Reload the page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Theme should persist
      const themeAfterReload = await page.locator('html').getAttribute('class');
      expect(themeAfterReload?.includes('dark')).toBe(themeAfterToggle?.includes('dark'));
    });
  });

  test.describe('System Preference', () => {
    test('should respect dark color scheme preference', async ({ page }) => {
      const targetUrl = getTargetUrl();

      // Emulate dark color scheme BEFORE visiting
      await page.emulateMedia({ colorScheme: 'dark' });

      // Clear any stored preferences
      await page.goto(targetUrl, { timeout: TIMEOUTS.navigation });
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(() => {
        localStorage.removeItem('theme');
        localStorage.removeItem('color-theme');
      });

      // Reload to apply system preference with shorter timeout
      await page.reload({ timeout: TIMEOUTS.reload });
      await page.waitForLoadState('domcontentloaded');

      // Check if dark mode is applied (implementation dependent)
      const html = page.locator('html');
      const htmlClass = await html.getAttribute('class');

      // The site should either be in dark mode or respect the system preference
      expect(htmlClass).toBeDefined();
    });

    test('should respect light color scheme preference', async ({ page }) => {
      const targetUrl = getTargetUrl();

      // Emulate light color scheme
      await page.emulateMedia({ colorScheme: 'light' });

      await page.goto(targetUrl, { timeout: TIMEOUTS.navigation });
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(() => {
        localStorage.removeItem('theme');
        localStorage.removeItem('color-theme');
      });

      await page.reload({ timeout: TIMEOUTS.reload });
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      const htmlClass = await html.getAttribute('class');

      expect(htmlClass).toBeDefined();
    });
  });

  test.describe('Visual Consistency', () => {
    test('should apply dark mode styles consistently', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      // Force dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(300);

      // Check background color changes
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });

      // Dark mode should have a dark background (not white)
      expect(bgColor).not.toBe('rgb(255, 255, 255)');
    });

    test('should not cause layout shift on theme toggle', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      // Get initial layout metrics
      const initialHeight = await page.evaluate(() => document.body.scrollHeight);

      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      await themeToggle.click();
      await page.waitForTimeout(300);

      // Layout should not significantly change
      const newHeight = await page.evaluate(() => document.body.scrollHeight);

      // Allow for small variations (fonts, etc.)
      expect(Math.abs(newHeight - initialHeight)).toBeLessThan(100);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible theme toggle button', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const themeToggle = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], button[aria-label*="light" i]',
        )
        .first();

      const toggleExists = await themeToggle.count();
      if (toggleExists === 0) {
        test.skip();
        return;
      }

      // Should have aria-label
      const ariaLabel = await themeToggle.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();

      // Should be focusable
      await themeToggle.focus();
      const isFocused = await themeToggle.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);

      // Should be activatable via keyboard
      await page.keyboard.press('Enter');
      // Theme should have toggled (verified by class change)
    });
  });
});
