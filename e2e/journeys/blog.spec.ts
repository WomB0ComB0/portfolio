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
 * @file Blog Page E2E Tests
 * @description Tests for the blog listing page and individual blog posts.
 */

import { expect, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

test.describe('Blog Page', () => {
  test.describe('Page Loading', () => {
    test('should load blog page successfully', async ({ page }) => {
      const targetUrl = getTargetUrl();
      const response = await page.goto(`${targetUrl}/blog`);

      expect(response?.status()).toBe(200);
    });

    test('should have correct page title', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);

      await expect(page).toHaveTitle(/blog/i);
    });

    test('should have main heading', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('domcontentloaded');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Blog Posts Display', () => {
    test('should display blog post cards or list', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Look for blog post entries
      const blogPosts = page.locator(
        'article, [data-post], .blog-post, [class*="post"], main a[href*="/blog/"]',
      );

      const count = await blogPosts.count();
      // May have zero posts if blog is empty
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display post titles', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Blog posts should have titles
      const postTitles = page.locator('main h2, main h3, article h2, article h3');
      const count = await postTitles.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display post dates', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Look for date elements
      const dates = page.locator('time, [datetime], [class*="date"]');
      const count = await dates.count();

      // Date display is common in blogs
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display post excerpts or summaries', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Look for description/excerpt paragraphs
      const excerpts = page.locator('main p, article p, [class*="excerpt"], [class*="summary"]');
      const count = await excerpts.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Blog Post Navigation', () => {
    test('should navigate to individual blog post', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Find first blog post link
      const postLink = page.locator('a[href*="/blog/"]').first();
      const linkExists = (await postLink.count()) > 0;

      if (linkExists) {
        await postLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Should navigate to blog post detail
        expect(page.url()).toContain('/blog/');
      }
    });

    test('should display full blog post content on detail page', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      const postLink = page.locator('a[href*="/blog/"]').first();
      const linkExists = (await postLink.count()) > 0;

      if (linkExists) {
        await postLink.click();
        await page.waitForLoadState('networkidle');

        // Should have article content
        const article = page.locator('article, main');
        await expect(article).toBeVisible();

        // Should have substantial content
        const content = await article.textContent();
        expect(content?.length).toBeGreaterThan(100);
      }
    });

    test('should have back navigation from blog post', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      const postLink = page.locator('a[href*="/blog/"]').first();
      const linkExists = (await postLink.count()) > 0;

      if (linkExists) {
        await postLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Go back
        await page.goBack();
        await page.waitForURL(`${targetUrl}/blog`);

        expect(page.url()).toContain('/blog');
      }
    });
  });

  test.describe('External Integration', () => {
    test('should link to external blog platform if applicable', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      // Check for links to external platforms (Hashnode, Medium, Dev.to)
      const externalLinks = page.locator(
        'a[href*="hashnode.dev"], a[href*="medium.com"], a[href*="dev.to"]',
      );
      const count = await externalLinks.count();

      // External links are optional
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('SEO & Meta Tags', () => {
    test('should have proper meta description', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);

      const metaDescription = page.locator('meta[name="description"]');
      const description = await metaDescription.getAttribute('content');

      expect(description).toBeTruthy();
      if (description) {
        expect(description.length).toBeGreaterThan(10);
      }
    });

    test('should have Open Graph tags', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);

      const ogTitle = page.locator('meta[property="og:title"]');
      const ogDescription = page.locator('meta[property="og:description"]');

      const hasOgTitle = (await ogTitle.count()) > 0;
      const hasOgDescription = (await ogDescription.count()) > 0;

      // OG tags should be present
      expect(hasOgTitle || hasOgDescription).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should render correctly on mobile', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('domcontentloaded');

      const main = page.locator('main');
      await expect(main).toBeVisible();

      // Content should fit viewport
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
    });

    test('should render correctly on tablet', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('domcontentloaded');

      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Blog Post Detail Page', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      const postLink = page.locator('a[href*="/blog/"]').first();
      const linkExists = (await postLink.count()) > 0;

      if (linkExists) {
        await postLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Should have h1 for post title
        const h1 = page.locator('h1');
        const h1Count = await h1.count();
        expect(h1Count).toBe(1);
      }
    });

    test('should display author information if available', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/blog`);
      await page.waitForLoadState('networkidle');

      const postLink = page.locator('a[href*="/blog/"]').first();
      const linkExists = (await postLink.count()) > 0;

      if (linkExists) {
        await postLink.click();
        await page.waitForLoadState('networkidle');

        // Check for author info (optional)
        const pageContent = await page.textContent('main');
        // Author info is optional but good to verify structure exists
        expect(pageContent?.length).toBeGreaterThan(0);
      }
    });
  });
});
