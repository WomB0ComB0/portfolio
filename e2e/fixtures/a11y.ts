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
 * @file What e2e/accessibility/a11y.spec.ts shares: the request guard (reads only, never the
 * production site), opening and settling a page for axe, running axe in the page, and finding
 * the dynamic routes from the listing pages. Paths are relative: the a11y config's baseURL
 * (A11Y_BASE_URL) is the only server these reach.
 */

import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';
import axe from 'axe-core';

import {
  formatViolations,
  REVIEW_AS_FAILURE_RULES,
  type ReportedViolation,
  WCAG_AA_TAGS,
} from '../../tests/utils/axe-report';
import { settle } from './ledger';

/** The production site's hosts: no request from these checks may reach them. */
const PRODUCTION_HOSTS: ReadonlySet<string> = new Set(['mikeodnis.dev', 'www.mikeodnis.dev']);

/** How long the finite animations a page starts may take to end before axe runs anyway. */
const ANIMATION_WAIT_MS = 5_000;
/** At most this many screens scrolled through to mount lazy sections. */
const MAX_SCROLL_STEPS = 60;
/** At most this many detail pages fetched while looking for one with a given part. */
const MAX_CANDIDATES = 40;
/** Detail pages fetched at once while searching for one that fits. */
const DISCOVERY_BATCH = 4;

const isProduction = (url: string): boolean => PRODUCTION_HOSTS.has(new URL(url).hostname);

const isRedirect = (status: number): boolean => status >= 300 && status < 400;

/** Redirect hops checked before a chain is let through; a longer chain is refused. */
const MAX_REDIRECT_HOPS = 10;

/**
 * Lets the browser read but never write: every request other than GET or HEAD is aborted (the
 * Sentry tunnel, analytics beacons, any form), and so is anything for the production site,
 * including through redirects. Playwright follows a redirect without routing its next hop, so a
 * redirect is never handed to the browser unchecked: the whole chain is walked first with redirects
 * off, and the request is aborted if any hop is the production site. A chain that stays clear is
 * let through for the browser to follow itself, so the page's URL still moves with it.
 */
export async function guardRequests(context: BrowserContext): Promise<void> {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const isRead = request.method() === 'GET' || request.method() === 'HEAD';
    if (!isRead || isProduction(request.url())) return route.abort();
    const first = await route.fetch({ maxRedirects: 0 }).catch(() => null);
    if (!first) return route.abort();
    if (!isRedirect(first.status())) return route.fulfill({ response: first });

    let response = first;
    let url = request.url();
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
      const location = response.headers().location;
      if (!isRedirect(response.status()) || !location) return route.continue();
      url = new URL(location, url).href;
      if (isProduction(url)) return route.abort();
      const next = await route.fetch({ url, maxRedirects: 0 }).catch(() => null);
      if (!next) return route.abort();
      response = next;
    }
    return route.abort();
  });
}

/**
 * Waits until the element `selector` matches carries React's props: its island has hydrated, so
 * its handlers answer. A page's islands can hydrate one after another (each Suspense boundary on
 * its own), so a check that presses a control waits for that control.
 */
export async function hydratedAt(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'));
  }, selector);
}

/** Opens `path`, expects `status`, and waits until it is settled and hydrated. */
export async function openPage(page: Page, path: string, status = 200): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await settle(page);
  // The skip link is the first element of every page, in the shell.
  await hydratedAt(page, 'a[href="#main-content"]');
}

/** Waits for the next frame and a task after it, while the page's clock runs. */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))),
  );
}

/** Waits for every finite animation and transition running now to end (or ANIMATION_WAIT_MS). */
export async function animationsDone(page: Page): Promise<void> {
  await page.evaluate(async (waitMs) => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return animation.playState === 'running' && timing?.endTime !== Number.POSITIVE_INFINITY;
    });
    await Promise.race([
      Promise.allSettled(finite.map((animation) => animation.finished)),
      new Promise((resolve) => setTimeout(resolve, waitMs)),
    ]);
  }, ANIMATION_WAIT_MS);
}

/**
 * Readies a settled page for axe: scrolls through it once, a screen per two frames, so lazily
 * mounted sections render, returns to the top, settles again, and lets entrance animations end
 * (a fading element would be measured mid-fade).
 */
export async function readyForAxe(page: Page): Promise<void> {
  await page.evaluate(async (maxSteps) => {
    const frame = (): Promise<void> =>
      new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const root = document.documentElement;
    for (
      let step = 0;
      step < maxSteps && step * window.innerHeight < root.scrollHeight;
      step += 1
    ) {
      window.scrollTo(0, step * window.innerHeight);
      await frame();
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  }, MAX_SCROLL_STEPS);
  await settle(page);
  await animationsDone(page);
}

/** An axe result as it comes back from the page: what a report prints, and its tags. */
type PageResult = ReportedViolation & { readonly tags: readonly string[] };

interface AxeOutcome {
  /** WCAG A and AA failures, and the needs-review results that count as failures here. */
  readonly failures: readonly PageResult[];
  /** Best-practice violations: reported beside the test, never failing it. */
  readonly bestPractice: readonly PageResult[];
}

const isWcag = (result: PageResult): boolean =>
  result.tags.some((tag) => (WCAG_AA_TAGS as readonly string[]).includes(tag));

/**
 * Runs axe 4.10 (the audit's) on the whole page: WCAG 2.0 to 2.2 A and AA plus best-practice in
 * one pass, iframes left out (third-party players and maps; their titles are still checked).
 * The source is injected with page.evaluate, which the config's bypassCSP allows.
 */
async function runAxe(page: Page): Promise<AxeOutcome> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(axe.source);
  const { violations, incomplete } = await page.evaluate(async (tags) => {
    const runner = (window as unknown as { axe: typeof axe }).axe;
    const results = await runner.run(document, {
      runOnly: { type: 'tag', values: [...tags, 'best-practice'] },
      resultTypes: ['violations', 'incomplete'],
      iframes: false,
    });
    const shape = (result: (typeof results.violations)[number]) => ({
      id: result.id,
      impact: result.impact,
      help: result.help,
      helpUrl: result.helpUrl,
      tags: result.tags,
      nodes: result.nodes.map((node) => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    });
    return { violations: results.violations.map(shape), incomplete: results.incomplete.map(shape) };
  }, WCAG_AA_TAGS);
  return {
    failures: [
      ...violations.filter(isWcag),
      ...incomplete.filter(
        (result) => isWcag(result) && REVIEW_AS_FAILURE_RULES.includes(result.id),
      ),
    ],
    bestPractice: violations.filter((result) => !isWcag(result)),
  };
}

/**
 * Runs axe on the page and fails with every WCAG A or AA failure (rule, impact, help, nodes).
 * Best-practice violations go into an annotation and an attachment instead.
 */
export async function expectNoAxeFailures(
  page: Page,
  testInfo: TestInfo,
  where: string,
): Promise<void> {
  const { failures, bestPractice } = await runAxe(page);
  if (bestPractice.length > 0) {
    testInfo.annotations.push({
      type: 'axe best-practice',
      description: bestPractice.map((result) => `${result.id} (${result.nodes.length})`).join(', '),
    });
    await testInfo.attach('axe best-practice', {
      body: formatViolations(bestPractice, where),
      contentType: 'text/plain',
    });
  }
  expect(
    failures.map((result) => result.id),
    formatViolations(failures, where),
  ).toEqual([]);
}

/** The detail pages the routes check, found from the listing pages; null where none has it. */
export interface DynamicRoutes {
  /** A project whose case study has a Screens section. */
  readonly projectWithScreens: string | null;
  /** A project with "See also" (writing and video about it), with photos and videos if any has. */
  readonly projectWithSeeAlso: string | null;
  /** The first role on /experience. */
  readonly experience: string | null;
  /** A place with two or more photos, so its viewer has Previous and Next. */
  readonly place: string | null;
}

/** The markup that marks each part, as the server renders it. */
const MARKS = {
  screens: 'data-case-section="screens"',
  seeAlso: 'data-project-media=""',
  photosAndVideos: 'id="project-media"',
  severalPhotos: 'aria-label="Next photo"',
} as const;

/** GETs `path` and returns its HTML; a listing page that fails fails the check that needs it. */
async function listingHtml(request: APIRequestContext, path: string): Promise<string> {
  // No redirects: a listing page that sends the request elsewhere is not read.
  const response = await request.get(path, { maxRedirects: 0 });
  expect(response.ok(), `GET ${path}`).toBe(true);
  return response.text();
}

/** Every distinct `/<section>/<id>` link in `html`, in order (/places/photos left out). */
function detailLinks(html: string, section: 'projects' | 'experience' | 'places'): string[] {
  const pattern = new RegExp(`href="(/${section}/[^"/?#]+)"`, 'g');
  const paths = Array.from(html.matchAll(pattern), (match) => match[1] ?? '');
  return [...new Set(paths)].filter((path) => path !== '' && path !== '/places/photos');
}

/** Fetches detail pages once each (up to MAX_CANDIDATES) and finds the first that passes. */
function detailFinder(request: APIRequestContext) {
  const pages = new Map<string, Promise<string>>();
  const htmlOf = (path: string): Promise<string> => {
    const known = pages.get(path);
    if (known) return known;
    // No redirects: a page that sends the request elsewhere is not this page. Any other failure is
    // a broken page and fails the check, rather than reading as a page without the part.
    const html = request.get(path, { maxRedirects: 0 }).then((response) => {
      if (isRedirect(response.status())) return '';
      expect(response.ok(), `GET ${path} answered ${response.status()}`).toBe(true);
      return response.text();
    });
    pages.set(path, html);
    return html;
  };
  return async (paths: readonly string[], test: (html: string) => boolean) => {
    const candidates = paths.slice(0, MAX_CANDIDATES);
    // A few at a time, so a long search fits the test's timeout; the first match in order wins.
    for (let start = 0; start < candidates.length; start += DISCOVERY_BATCH) {
      const batch = candidates.slice(start, start + DISCOVERY_BATCH);
      const htmls = await Promise.all(batch.map(htmlOf));
      const hit = batch.find((_, index) => test(htmls[index] ?? ''));
      if (hit) return hit;
    }
    return null;
  };
}

/** Finds the dynamic routes from /projects, /media, /experience and /places. */
async function discover(request: APIRequestContext): Promise<DynamicRoutes> {
  const [projectsHtml, mediaHtml, experienceHtml, placesHtml] = await Promise.all([
    listingHtml(request, '/projects'),
    listingHtml(request, '/media'),
    listingHtml(request, '/experience'),
    listingHtml(request, '/places'),
  ]);
  const projects = detailLinks(projectsHtml, 'projects');
  // Projects /media links to (its rows' "Project:" references) have writing or video about them.
  const projectsWithMedia = [...new Set([...detailLinks(mediaHtml, 'projects'), ...projects])];
  const firstWhere = detailFinder(request);

  const projectWithScreens = await firstWhere(projects, (html) => html.includes(MARKS.screens));
  const projectWithSeeAlso =
    (await firstWhere(
      projectsWithMedia,
      (html) => html.includes(MARKS.seeAlso) && html.includes(MARKS.photosAndVideos),
    )) ?? (await firstWhere(projectsWithMedia, (html) => html.includes(MARKS.seeAlso)));
  const place = await firstWhere(detailLinks(placesHtml, 'places'), (html) =>
    html.includes(MARKS.severalPhotos),
  );
  return {
    projectWithScreens,
    projectWithSeeAlso,
    experience: detailLinks(experienceHtml, 'experience')[0] ?? null,
    place,
  };
}

let discovered: Promise<DynamicRoutes> | undefined;

/**
 * The dynamic routes, found once per worker from the listing pages (GET only, through the
 * context's baseURL). A failed search is not kept, so the next test tries again.
 */
export function dynamicRoutes(request: APIRequestContext): Promise<DynamicRoutes> {
  discovered ??= discover(request).catch((error: unknown) => {
    discovered = undefined;
    throw error;
  });
  return discovered;
}
