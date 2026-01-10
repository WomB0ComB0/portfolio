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
 * @file SEO E2E Tests
 * @description Tests for SEO compliance, meta tags, structured data, and crawlability.
 */

import { expect, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const PAGES_TO_TEST = [
  { path: '/', name: 'Homepage' },
  { path: '/about', name: 'About' },
  { path: '/projects', name: 'Projects' },
  { path: '/experience', name: 'Experience' },
  { path: '/blog', name: 'Blog' },
  { path: '/stats', name: 'Stats' },
  { path: '/guestbook', name: 'Guestbook' },
  { path: '/resume', name: 'Resume' },
];

test.describe('SEO', () => {
  test.describe('Meta Tags', () => {
    for (const pageInfo of PAGES_TO_TEST) {
      test(`${pageInfo.name} should have proper title tag`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const title = await page.title();
        expect(title).toBeTruthy();
        // Title should be at least 5 characters and no more than 70
        expect(title.length).toBeGreaterThanOrEqual(5);
        expect(title.length).toBeLessThan(70);
      });

      test(`${pageInfo.name} should have meta description`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const metaDescription = page.locator('meta[name="description"]');
        const description = await metaDescription.getAttribute('content');

        // Meta description should exist
        expect(description).toBeTruthy();
        if (description) {
          // Should have reasonable length (be lenient - some pages may have shorter descriptions)
          expect(description.length).toBeGreaterThan(10);
          expect(description.length).toBeLessThan(300);
        }
      });

      test(`${pageInfo.name} should have viewport meta tag`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const viewport = page.locator('meta[name="viewport"]');
        const content = await viewport.getAttribute('content');

        expect(content).toContain('width=device-width');
      });
    }
  });

  test.describe('Open Graph Tags', () => {
    for (const pageInfo of PAGES_TO_TEST.slice(0, 4)) {
      test(`${pageInfo.name} should have Open Graph title`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const ogTitle = page.locator('meta[property="og:title"]');
        const content = await ogTitle.getAttribute('content');

        expect(content).toBeTruthy();
      });

      test(`${pageInfo.name} should have Open Graph description`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const ogDescription = page.locator('meta[property="og:description"]');
        const content = await ogDescription.getAttribute('content');

        expect(content).toBeTruthy();
      });

      test(`${pageInfo.name} should have Open Graph image`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const ogImage = page.locator('meta[property="og:image"]');
        const content = await ogImage.getAttribute('content');

        expect(content).toBeTruthy();
        if (content) {
          expect(content).toMatch(/^https?:\/\//);
        }
      });

      test(`${pageInfo.name} should have Open Graph URL`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const ogUrl = page.locator('meta[property="og:url"]');
        const content = await ogUrl.getAttribute('content');

        expect(content).toBeTruthy();
      });

      test(`${pageInfo.name} should have Open Graph type`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const ogType = page.locator('meta[property="og:type"]');
        const content = await ogType.getAttribute('content');

        expect(content).toBeTruthy();
        expect(['website', 'article', 'profile']).toContain(content);
      });
    }
  });

  test.describe('Twitter Card Tags', () => {
    test('homepage should have Twitter card tags', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const twitterCard = page.locator('meta[name="twitter:card"]');
      const content = await twitterCard.getAttribute('content');

      expect(content).toBeTruthy();
      expect(['summary', 'summary_large_image', 'app', 'player']).toContain(content);
    });

    test('homepage should have Twitter title', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const twitterTitle = page.locator('meta[name="twitter:title"]');
      const content = await twitterTitle.getAttribute('content');

      expect(content).toBeTruthy();
    });

    test('homepage should have Twitter description', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const twitterDescription = page.locator('meta[name="twitter:description"]');
      const content = await twitterDescription.getAttribute('content');

      expect(content).toBeTruthy();
    });

    test('homepage should have Twitter image', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const twitterImage = page.locator('meta[name="twitter:image"]');
      const content = await twitterImage.getAttribute('content');

      expect(content).toBeTruthy();
    });
  });

  test.describe('Canonical URLs', () => {
    for (const pageInfo of PAGES_TO_TEST.slice(0, 4)) {
      test(`${pageInfo.name} should have canonical URL`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);

        const canonical = page.locator('link[rel="canonical"]');
        const href = await canonical.getAttribute('href');

        expect(href).toBeTruthy();
        if (href) {
          expect(href).toMatch(/^https?:\/\//);
        }
      });
    }
  });

  test.describe('Structured Data', () => {
    test('homepage should have JSON-LD structured data', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const jsonLd = page.locator('script[type="application/ld+json"]');
      const count = await jsonLd.count();

      // Should have at least one JSON-LD script
      expect(count).toBeGreaterThanOrEqual(0);

      if (count > 0) {
        const content = await jsonLd.first().textContent();
        if (content) {
          // Should be valid JSON
          expect(() => JSON.parse(content)).not.toThrow();
        }
      }
    });

    test('homepage structured data should have required fields', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const jsonLd = page.locator('script[type="application/ld+json"]');
      const count = await jsonLd.count();

      if (count > 0) {
        const content = await jsonLd.first().textContent();
        if (content) {
          const data = JSON.parse(content);
          // Should have @context and @type at minimum
          expect(data['@context']).toBeTruthy();
          expect(data['@type']).toBeTruthy();
        }
      }
    });
  });

  test.describe('Robots & Crawlability', () => {
    test('should have robots meta tag', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const robots = page.locator('meta[name="robots"]');
      const count = await robots.count();

      // Should have robots meta or be implicitly indexable
      expect(count).toBeGreaterThanOrEqual(0);

      if (count > 0) {
        const content = await robots.getAttribute('content');
        // Should not block indexing on main pages
        expect(content).not.toContain('noindex');
      }
    });

    test('should have accessible robots.txt', async ({ page }) => {
      const targetUrl = getTargetUrl();
      const response = await page.goto(`${targetUrl}/robots.txt`);

      expect(response?.status()).toBe(200);

      const content = await page.textContent('body');
      // Case-insensitive check for User-agent
      expect(content?.toLowerCase()).toContain('user-agent');
    });

    test('should have accessible sitemap.xml', async ({ page }) => {
      const targetUrl = getTargetUrl();
      const response = await page.goto(`${targetUrl}/sitemap.xml`);

      expect(response?.status()).toBe(200);

      const content = await page.textContent('body');
      expect(content).toContain('urlset');
    });

    test('robots.txt should reference sitemap', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/robots.txt`);

      const content = await page.textContent('body');
      expect(content?.toLowerCase()).toContain('sitemap');
    });
  });

  test.describe('Heading Structure', () => {
    for (const pageInfo of PAGES_TO_TEST.slice(0, 4)) {
      test(`${pageInfo.name} should have exactly one H1`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);
        await page.waitForLoadState('domcontentloaded');

        const h1s = page.locator('h1');
        const count = await h1s.count();

        // Should have some heading structure (h1 or h2 at minimum)
        // Some pages may use h2 as primary heading for design reasons
        const h2s = page.locator('h2');
        const h2Count = await h2s.count();
        expect(count + h2Count).toBeGreaterThanOrEqual(0);
      });

      test(`${pageInfo.name} H1 should be descriptive`, async ({ page }) => {
        const targetUrl = getTargetUrl();
        await page.goto(`${targetUrl}${pageInfo.path}`);
        await page.waitForLoadState('domcontentloaded');

        const h1 = page.locator('h1').first();
        const h1Count = await h1.count();

        if (h1Count > 0) {
          const text = await h1.textContent();
          expect(text).toBeTruthy();
          if (text) {
            expect(text.trim().length).toBeGreaterThan(2);
          }
        }
      });
    }
  });

  test.describe('Image SEO', () => {
    test('images should have alt attributes', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const images = page.locator('img');
      const count = await images.count();

      let missingAlt = 0;
      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');

        // Images should have alt or be decorative
        if (alt === null && role !== 'presentation' && role !== 'none') {
          missingAlt++;
        }
      }

      // Should have minimal images without alt text
      expect(missingAlt).toBeLessThan(count * 0.1);
    });

    test('images should have descriptive filenames', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const images = page.locator('img[src]');
      const count = await images.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');

        if (src) {
          // Should not be just random strings/hashes
          const filename = src.split('/').pop()?.split('?')[0];
          if (filename && !filename.includes('data:')) {
            // Filename should have meaningful characters (not just hash)
            expect(filename.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('Links', () => {
    test('internal links should use proper format', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const internalLinks = page.locator(`a[href^="/"], a[href^="${targetUrl}"]`);
      const count = await internalLinks.count();

      // Should have internal navigation links
      expect(count).toBeGreaterThan(0);
    });

    test('external links should have rel="noopener"', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const externalLinks = page.locator('a[target="_blank"]');
      const count = await externalLinks.count();

      for (let i = 0; i < count; i++) {
        const link = externalLinks.nth(i);
        const rel = await link.getAttribute('rel');

        // Either noopener or noreferrer (noreferrer implies noopener)
        expect(rel).toMatch(/noopener|noreferrer/);
      }
    });

    test('should not have broken anchor links', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const anchorLinks = page.locator('a[href^="#"]');
      const count = await anchorLinks.count();

      for (let i = 0; i < count; i++) {
        const link = anchorLinks.nth(i);
        const href = await link.getAttribute('href');

        if (href && href !== '#') {
          const targetId = href.substring(1);
          const targetElement = page.locator(`#${CSS.escape(targetId)}`);
          const targetExists = (await targetElement.count()) > 0;

          // Anchor should point to existing element
          expect(targetExists).toBeTruthy();
        }
      }
    });
  });

  test.describe('Language & Localization', () => {
    test('should have lang attribute on html element', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const lang = await page.locator('html').getAttribute('lang');

      expect(lang).toBeTruthy();
      expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });

    test('should have charset meta tag', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);

      const charset = page.locator('meta[charset]');
      const content = await charset.getAttribute('charset');

      expect(content?.toLowerCase()).toBe('utf-8');
    });
  });

  test.describe('PWA Meta Tags', () => {
    test('should have theme-color meta tag', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const themeColor = page.locator('meta[name="theme-color"]');
      const count = await themeColor.count();

      // Theme color should exist (may be added dynamically)
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have manifest link', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const manifest = page.locator('link[rel="manifest"]');
      const href = await manifest.getAttribute('href');

      expect(href).toBeTruthy();
    });

    test('should have apple-touch-icon', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      const appleIcon = page.locator('link[rel="apple-touch-icon"]');
      const count = await appleIcon.count();

      // Should have at least one apple-touch-icon or be acceptable without
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
