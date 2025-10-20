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
import { getURL } from '../utils/formatting/helpers';

test('visit page and take screenshot', async ({ page }) => {
  const targetUrl = getURL() || 'https://www.mikeodnis.dev';

  const response = await page.goto(targetUrl);

  expect(response?.status(), 'should respond with correct status code').toBeLessThan(400);

  await page.screenshot({ path: 'screenshot.jpg' });
});
