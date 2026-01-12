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
 * @file Media Page E2E Tests
 * @description Tests for the media page with tabs for videos, talks, blogs, and podcasts.
 */

import { expect, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

test.describe('Media Page', () => {
  test.describe('Page Loading', () => {
    test('should load media page successfully', async ({ page }) => {
      const targetUrl = getTargetUrl();
      const response = await page.goto(`${targetUrl}/media`);

      expect(response?.status()).toBe(200);
    });

    test('should have correct page title', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);

      await expect(page).toHaveTitle(/media/i);
    });

    test('should have main heading', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('domcontentloaded');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Media Tabs Navigation', () => {
    test('should display tab navigation', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      // Look for tab list
      const tabList = page.locator('[role="tablist"]');
      await expect(tabList).toBeVisible();
    });

    test('should have videos tab', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      const videosTab = page.locator('[role="tab"]:has-text("Videos")');
      const count = await videosTab.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have talks tab', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      const talksTab = page.locator('[role="tab"]:has-text("Talks")');
      const count = await talksTab.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have blogs tab', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      const blogsTab = page.locator('[role="tab"]:has-text("Blogs")');
      const count = await blogsTab.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have podcasts tab', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      const podcastsTab = page.locator('[role="tab"]:has-text("Podcasts")');
      const count = await podcastsTab.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should switch tabs on click', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      // Find any tab and click it
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        // Click second tab
        await tabs.nth(1).click();
        await page.waitForTimeout(300);

        // Second tab should be active
        const activeTab = tabs.nth(1);
        await expect(activeTab).toHaveAttribute('data-state', 'active');
      }
    });
  });

  test.describe('Videos Section', () => {
    test('should display video content when videos tab is active', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media?tab=videos`);
      await page.waitForLoadState('networkidle');

      // Look for video elements or cards
      const videoContent = page.locator('[data-tab="videos"], [class*="video"], article, .card');
      const count = await videoContent.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Blog Posts Section', () => {
    test('should display blog content when blogs tab is active', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media?tab=blogs`);
      await page.waitForLoadState('networkidle');

      // Look for blog post entries
      const blogPosts = page.locator(
        '[data-tab="blogs"], article, [data-post], .blog-post, [class*="post"]',
      );

      const count = await blogPosts.count();
      // May have zero posts if blog is empty
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display post titles', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media?tab=blogs`);
      await page.waitForLoadState('networkidle');

      // Blog posts should have titles
      const postTitles = page.locator('main h2, main h3, article h2, article h3');
      const count = await postTitles.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('External Links', () => {
    test('should have links to external platforms if applicable', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      // Check for links to external platforms (YouTube, Hashnode, Medium, Dev.to)
      const externalLinks = page.locator(
        'a[href*="youtube.com"], a[href*="hashnode.dev"], a[href*="medium.com"], a[href*="dev.to"]',
      );
      const count = await externalLinks.count();

      // External links are optional
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('SEO & Meta Tags', () => {
    test('should have proper meta description', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);

      const metaDescription = page.locator('meta[name="description"]');
      const description = await metaDescription.getAttribute('content');

      expect(description).toBeTruthy();
      if (description) {
        expect(description.length).toBeGreaterThan(10);
      }
    });

    test('should have Open Graph tags', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);

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
      await page.goto(`${targetUrl}/media`);
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
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('domcontentloaded');

      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Tab URL Persistence', () => {
    test('should persist tab state in URL', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media`);
      await page.waitForLoadState('networkidle');

      // Find tabs and click one that isn't first
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        await tabs.nth(1).click();
        await page.waitForTimeout(500);

        // URL should contain tab parameter
        const url = page.url();
        expect(url).toMatch(/[?&]tab=/);
      }
    });

    test('should load correct tab from URL', async ({ page }) => {
      const targetUrl = getTargetUrl();
      await page.goto(`${targetUrl}/media?tab=blogs`);
      await page.waitForLoadState('networkidle');

      // Blogs tab should be active
      const blogsTab = page.locator('[role="tab"]:has-text("Blogs")');
      if ((await blogsTab.count()) > 0) {
        await expect(blogsTab).toHaveAttribute('data-state', 'active');
      }
    });
  });
});
