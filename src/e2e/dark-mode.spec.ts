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

import { expect, test } from '@playwright/test';

test('dark mode toggle', async ({ page }) => {
  const targetUrl = process.env.ENVIRONMENT_URL || 'https://www.mikeodnis.dev';

  await page.goto(targetUrl);

  const html = page.locator('html');
  const initialClass = await html.getAttribute('class');

  const darkModeButton = page.locator('button[aria-label="Toggle Dark Mode"]');
  await darkModeButton.click();

  const newClass = await html.getAttribute('class');
  expect(newClass).not.toBe(initialClass);
});
