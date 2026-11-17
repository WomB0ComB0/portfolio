import { expect, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { settle } from '../fixtures/ledger';

const ID = 'exp-develop-for-good';
const POSITIONS = ['Program Lead', 'Product Lead', 'Engineering Manager', 'Software Engineer'];
const PERIODS = [
  ['2025-09', '2026-02'],
  ['2025-04', '2025-09'],
  ['2024-10', '2025-03'],
  ['2024-04', '2024-09'],
];
for (const profile of [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
]) {
  test.describe(`${profile.name} experience progression`, () => {
    test.use({
      viewport: profile,
      isMobile: profile.mobile,
      hasTouch: profile.mobile,
      serviceWorkers: 'block',
    });
    test.beforeEach(async ({ page }) => {
      await page.route('**/*', (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (
          url.port === '3000' ||
          !['GET', 'HEAD'].includes(req.method()) ||
          /sentry|analytics|logtail|monitoring/.test(url.href)
        )
          return route.abort();
        if (url.pathname === '/api/v1/link-health') return route.fulfill({ json: { links: {} } });
        return route.continue();
      });
    });
    test('index nests four dated positions in one organization entry', async ({ page }) => {
      await page.goto(getTargetUrl() + '/experience');
      await settle(page);
      const parent = page.locator(`[data-role-row][data-id="${ID}"]`);
      await expect(parent).toHaveCount(1);
      const children = parent.locator('[data-sub-role]');
      await expect(children).toHaveCount(4);
      await expect(children.locator('h4')).toHaveText(POSITIONS);
      await expect(parent.locator('[data-role-row]')).toHaveCount(0);
      for (let i = 0; i < 4; i++) {
        const periods = await children
          .nth(i)
          .locator('[data-sub-role-period] time')
          .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')));
        expect(periods).toEqual(PERIODS[i]);
      }
      const link = parent.locator('[data-role-page]');
      await expect(link).toContainText('Software Engineer → Program Lead');
      await link.click();
      await settle(page);
      await expect(page).toHaveURL(new RegExp(`/experience/${ID}$`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
    });
    test('detail shows staggered ranges and keeps the logo responsive', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(getTargetUrl() + '/experience/' + ID);
      await settle(page);
      const history = page.locator('[data-role-progression="full"]');
      await expect(history.getByRole('heading', { level: 3 })).toHaveText(POSITIONS);
      const ranges = await history.locator('[data-sub-role-lane]').evaluateAll((tracks) =>
        tracks.map((track) => {
          const full = track.getBoundingClientRect();
          const bar = track.firstElementChild?.getBoundingClientRect();
          if (!bar) throw new Error('Missing interval');
          return {
            left: (bar.left - full.left) / full.width,
            width: bar.width / full.width,
            fits: bar.left >= full.left - 1 && bar.right <= full.right + 1,
          };
        }),
      );
      expect(ranges).toHaveLength(4);
      expect(ranges.every((range) => range.fits && range.width > 0)).toBe(true);
      for (let i = 0; i < ranges.length - 1; i++)
        expect(ranges[i]?.left).toBeGreaterThan(ranges[i + 1]?.left ?? 1);
      const logo = await page.locator('[data-role-detail-logo]').boundingBox();
      const title = await page.locator('main h1').boundingBox();
      if (!logo || !title) throw new Error('Missing header');
      expect(profile.mobile ? logo.y + logo.height < title.y : logo.x + logo.width < title.x).toBe(
        true,
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      expect(errors).toEqual([]);
      if (profile.mobile) {
        await page.setViewportSize({ width: 320, height: 900 });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        await expect(history).toBeVisible();
      }
    });
  });
}
