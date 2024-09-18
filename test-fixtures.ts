import {
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  test as base,
  expect,
} from '@playwright/test';

export * from '@playwright/test';
export { expect };

type TestExtras = {};

export const test = base.extend<
  PlaywrightTestArgs &
    PlaywrightTestOptions & {
      page: Page & TestExtras;
    }
>({
  //@ts-ignore
  page: async ({ baseURL, page }, use, testInfo) => {
    const testFilePath = testInfo.titlePath[0] || '';

    const fileName = testFilePath.replace('.spec.ts', '');

    const url = `${baseURL}${fileName}`;

    await page.goto(url);

    await use(page);
  },
});
