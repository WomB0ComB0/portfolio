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
  status: 'unavailable' | 'temporary' | 'reachable' | 'pair' = 'unavailable',
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
      const warningTargets =
        status === 'pair'
          ? await page
              .locator('main [data-project-link], main [data-case-link]')
              .evaluateAll((anchors) =>
                anchors.slice(0, 2).map((anchor) => {
                  const url = new URL((anchor as HTMLAnchorElement).href);
                  url.hash = '';
                  return url.href;
                }),
              )
          : [];
      const links = Object.fromEntries(
        hrefs.flatMap((href) => {
          const target = new URL(href);
          if (!['https:', 'http:'].includes(target.protocol)) return [];
          target.hash = '';
          const index = warningTargets.indexOf(target.href);
          const observation =
            status === 'pair' ? (index >= 0 ? 'unavailable' : 'reachable') : status;
          return [[target.href, { status: observation, checkedAt: new Date().toISOString() }]];
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
  test.describe(`${profile.name} link health`, () => {
    test.use({
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.name === 'phone',
      hasTouch: profile.name === 'phone',
      serviceWorkers: 'block',
    });
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
    test('Notion case studies remain usable without automated unavailable labels', async ({
      page,
    }) => {
      await fixture(page, 'unavailable');
      await page.goto(getTargetUrl() + '/experience/exp-develop-for-good');
      await settle(page);
      const notion = page.locator('main a[href*=".notion.site/"]');
      expect(await notion.count()).toBeGreaterThanOrEqual(4);
      await expect(page.locator('[data-link-health-url*=".notion.site/"]')).toHaveCount(0);
      await expect(notion.first()).not.toHaveAttribute('aria-disabled', 'true');
      await notion.first().scrollIntoViewIfNeeded();
      await notion.first().click({ trial: true });
    });
    if (profile.name === 'phone') {
      for (const [path, selector] of [
        ['/projects', 'main [data-project-link]'],
        ['/projects/first', 'main [data-case-link]'],
      ] as const) {
        test(`phone: ${path} has separate 44px touch action targets with both warnings`, async ({
          page,
        }) => {
          await fixture(page, 'pair');
          await openDestination(page, path);
          expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
          await expect(page.locator('[data-link-health="unavailable"]').first()).toBeVisible();
          await expect(page.locator('[data-link-health="unavailable"]').nth(1)).toBeVisible();
          await page
            .locator('[data-link-health]')
            .first()
            .evaluate((element) =>
              element.scrollIntoView({ block: 'center', behavior: 'instant' }),
            );
          const boxes = await page.locator(selector).evaluateAll((links) =>
            links.slice(0, 2).map((link) => {
              const box = link.getBoundingClientRect();
              return {
                href: (link as HTMLAnchorElement).href,
                left: box.left,
                right: box.right,
                top: box.top,
                bottom: box.bottom,
                width: box.width,
                height: box.height,
              };
            }),
          );
          expect(boxes).toHaveLength(2);
          const [live, code] = boxes;
          if (!live || !code) throw new Error('missing Live or Code target');
          expect(live.href).not.toBe(code.href);
          for (const box of boxes) {
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
          }
          const overlap =
            Math.min(live.right, code.right) > Math.max(live.left, code.left) &&
            Math.min(live.bottom, code.bottom) > Math.max(live.top, code.top);
          expect(overlap, JSON.stringify({ live, code })).toBe(false);
        });
      }
      test('inconclusive checks, healthy links and stable-service pages have no warnings', async ({
        page,
      }) => {
        const temporary = await fixture(page, 'temporary');
        await openDestination(page, '/projects');
        await expect.poll(() => temporary.requests.length).toBeGreaterThan(0);
        await expect(page.locator(BADGE)).toHaveCount(0);
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
    }
  });
}
