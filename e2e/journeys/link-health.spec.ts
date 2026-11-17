/** Link-health labels with deterministic observations, never probes or writes to live targets. */
import { expect, type Page, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { settle } from '../fixtures/ledger';

const BADGE = '[data-link-health]';
const profiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

async function fixture(
  page: Page,
  status: 'unavailable' | 'temporary' | 'reachable' = 'unavailable',
) {
  const requests: string[] = [];
  const pageErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/_next/static/') && response.status() >= 400)
      failedAssets.push(response.url());
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.port === '3000' ||
      !['GET', 'HEAD'].includes(request.method()) ||
      /sentry|analytics|logtail|betterstack/.test(url.hostname)
    )
      return route.abort();
    if (url.pathname === '/api/v1/link-health') {
      requests.push(url.searchParams.get('scope') ?? '');
      const hrefs = await page
        .locator('main a[href]')
        .evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
      const links = Object.fromEntries(
        hrefs.flatMap((href) => {
          const target = new URL(href);
          if (!['https:', 'http:'].includes(target.protocol)) return [];
          target.hash = '';
          return [[target.href, { status, checkedAt: new Date().toISOString() }]];
        }),
      );
      return route.fulfill({ json: { links } });
    }
    return route.continue();
  });
  return { requests, pageErrors, failedAssets };
}

async function openDestination(page: Page, path: string) {
  const match = /^(\/projects|\/experience)\/first$/.exec(path);
  if (match) {
    await page.goto(getTargetUrl() + match[1]);
    await settle(page);
    // The first role currently has no outbound destinations; choose a role that offers one.
    const destination =
      match[1] === '/experience'
        ? page
            .locator('main [data-role-row]')
            .filter({ has: page.locator('a[href^="https://"]') })
            .first()
            .locator('[data-role-page]')
        : page.locator(`main a[href^="${match[1]}/"]`).first();
    const href = await destination.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(getTargetUrl() + href);
  } else {
    await page.goto(getTargetUrl() + path);
  }
  await settle(page);
}

for (const profile of profiles) {
  for (const [path, scope] of [
    ['/projects', 'projects'],
    ['/projects/first', 'projects'],
    ['/media', 'media'],
    ['/certifications', 'certifications'],
    ['/experience/first', 'experience'],
  ] as const) {
    test(`${profile.name}: ${path} shows cached warnings without blocking links or overflowing`, async ({
      page,
    }) => {
      await page.setViewportSize(profile);
      const report = await fixture(page);
      await openDestination(page, path);
      if (path === '/experience/first') {
        const logo = page.locator('[data-role-detail-logo]');
        await expect(logo).toBeVisible();
        const bounds = await logo.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(80);
        expect(bounds?.height).toBeGreaterThanOrEqual(80);
        const image = logo.locator('img');
        if (await image.count()) {
          await expect(image).toHaveCSS('object-fit', 'contain');
          await expect
            .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
            .toBeGreaterThan(0);
        }
      }
      const badge = page.locator(BADGE).first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('Unavailable');
      await expect(badge).toContainText('Checked');
      expect(report.requests).toContain(scope);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
      ).toBe(false);
      const url = await badge.getAttribute('data-link-health-url');
      expect(url).toBeTruthy();
      const links = page.locator('main a[href]');
      const index = await links.evaluateAll(
        (anchors, canonical) =>
          anchors.findIndex((anchor) => {
            const href = new URL((anchor as HTMLAnchorElement).href);
            href.hash = '';
            return href.href === canonical;
          }),
        url,
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const link = links.nth(index);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).not.toHaveAttribute('aria-disabled', 'true');
      await link.scrollIntoViewIfNeeded();
      await link.click({ trial: true });
      expect(report.pageErrors).toEqual([]);
      expect(report.failedAssets).toEqual([]);
      // A page's many badges share one request, and an immediate same-scope navigation reuses it.
      expect(report.requests.filter((value) => value === scope).length).toBeLessThanOrEqual(2);
    });
  }
}

test('temporary failures are distinct; healthy links and stable-service pages have no warnings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const temporary = await fixture(page, 'temporary');
  await openDestination(page, '/projects');
  await expect(page.locator(BADGE).first()).toContainText('Temporarily unreachable');
  await page.unroute('**/*');
  const healthy = await fixture(page, 'reachable');
  await page.reload();
  await settle(page);
  await expect.poll(() => healthy.requests.length).toBeGreaterThan(0);
  await expect(page.locator(BADGE)).toHaveCount(0);
  for (const path of ['/places', '/spotify']) {
    await page.goto(getTargetUrl() + path);
    await settle(page);
    await expect(page.locator(BADGE)).toHaveCount(0);
  }
  expect(temporary.pageErrors).toEqual([]);
  expect(healthy.pageErrors).toEqual([]);
  expect(healthy.requests.every((scope) => scope === 'projects')).toBe(true);
});
