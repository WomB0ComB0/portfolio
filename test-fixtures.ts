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

import {
  test as base,
  expect,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
} from '@playwright/test';

// Extend basic test by providing a "todoPage" fixture.
// This fixture can be used in tests by calling test.use().
// For example, test.use({ todoPage: new TodoPage(page) });

// Declare the type of the fixtures.
export { expect };

type TestExtras = PlaywrightTestArgs &
  PlaywrightTestOptions & {
    page: Page & TestExtras;
  };

export const test = base.extend<TestExtras>({
  page: async ({ baseURL, page }, use, testInfo) => {
    const testFilePath = testInfo.titlePath[0] || '';

    const fileName = testFilePath.replace('.spec.ts', '');

    const url = `${baseURL}${fileName}`;

    await page.goto(url);

    await use(page);
  },
});
