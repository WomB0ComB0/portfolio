/**
 * Copyright 2026 Mike Odnis
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
 * @file /sponsor as "Ways first", read from its server HTML: the ways are plain links in the HTML
 * (no Suspense placeholder, no client gate), the Sponsor on GitHub action is the page's first
 * link, mail stays in this tab, and the thank-you row, its empty state and its error all render
 * without client code. No rates anywhere (the owner's "I don't think that needs to be there").
 * The production default hides benefits and amounts; several-person states use local fixtures.
 *
 * A few class checks remain for the thank-you names (wrapping under the avatars, the underline,
 * "now" kept with its name, the failed-avatar cover): the live page has one past sponsor, so no
 * browser check can reach those states without the lab's samples.
 */

import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profile } from '@/constants/profile';
import type { GitHubSponsorsData, Sponsor } from '@/lib/api-integrations/github-sponsors';

const { getGitHubSponsors, reportApiFailure } = vi.hoisted(() => ({
  getGitHubSponsors: vi.fn<() => Promise<GitHubSponsorsData>>(),
  reportApiFailure: vi.fn(() => true),
}));

vi.mock('@/lib/api-integrations/github-sponsors', () => ({ getGitHubSponsors }));

vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportApiFailure,
}));

import { SponsorView } from '@/app/(routes)/(dev)/sponsor/_components/sponsor-view';
import { SPONSORS_DEADLINE_MS } from '@/app/(routes)/(dev)/sponsor/_lib/load-sponsors';
import {
  DEFAULT_SPONSOR_OPTIONS,
  type SponsorViewOptions,
} from '@/app/(routes)/(dev)/sponsor/_lib/options';
import SponsorPage, { metadata } from '@/app/(routes)/(dev)/sponsor/page';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/WomB0ComB0';
const WAY_NAMES = ['GitHub Sponsors', 'Open Collective', 'Ko-fi', 'Buy Me a Coffee'];
const RAW_ERROR = 'HTTP 502 Bad Gateway {"message":"Server Error"}';

const makeSponsor = (overrides: Partial<Sponsor> = {}): Sponsor => ({
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  url: 'https://github.com/octocat',
  tier: null,
  createdAt: '2025-01-01T00:00:00Z',
  isActive: false,
  type: 'User',
  ...overrides,
});

const sponsorsData = (sponsors: Sponsor[]): GitHubSponsorsData => ({
  sponsors,
  totalCount: sponsors.length,
  totalMonthlyIncome: 0,
});

/** HTML parsed into a detached element, so it can be queried like a page with JS off. */
function parse(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

/** The real route's server HTML, as a crawler or a reader with JS off receives it. */
async function routeHtml(): Promise<{ html: string; root: HTMLElement }> {
  const html = renderToString(await SponsorPage());
  return { html, root: parse(html) };
}

/** The view with the given switches, rendered to HTML. */
function viewHtml(
  options: SponsorViewOptions,
  data: GitHubSponsorsData | null = sponsorsData([]),
): HTMLElement {
  return parse(renderToString(<SponsorView sponsors={data} options={options} />));
}

/** Visible text, whitespace collapsed, without NewTabArrow's invisible U+2060 WORD JOINER. */
const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/⁠/g, '').replace(/\s+/g, ' ').trim() ?? '';

const waysSection = (root: HTMLElement): HTMLElement => {
  const section = root.querySelector<HTMLElement>('[data-sponsor-ways]');
  if (!section) throw new Error('no ways section in the HTML');
  return section;
};

const thanksSection = (root: HTMLElement): HTMLElement => {
  const section = root.querySelector<HTMLElement>('[data-sponsor-thanks-section]');
  if (!section) throw new Error('no thank-you section in the HTML');
  return section;
};

beforeEach(() => {
  getGitHubSponsors.mockReset();
  reportApiFailure.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/sponsor server HTML', () => {
  it('has the ways as plain links, with no Suspense placeholder, skeleton or client gate', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([makeSponsor()]));

    const { html, root } = await routeHtml();

    const links = Array.from(waysSection(root).querySelectorAll('li h3 a[href]'));
    expect(links.map((link) => textOf(link).replace(/\s*\(opens in a new tab\)$/, ''))).toEqual(
      WAY_NAMES,
    );
    // Nothing waits on the client: no pending boundary, no streamed template, nothing busy.
    expect(html).not.toContain('<!--$?-->');
    expect(html).not.toContain('<template');
    expect(root.querySelector('[aria-busy="true"], output[aria-label^="Loading"]')).toBeNull();
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it('leads with Sponsor on GitHub: the first link on the page, opening a new tab', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([]));

    const { root } = await routeHtml();

    const first = root.querySelector('a[href]');
    expect(textOf(first)).toMatch(/^Sponsor on GitHub/);
    expect(first).toHaveAttribute('href', GITHUB_SPONSORS_URL);
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', 'noopener noreferrer');
    expect(textOf(waysSection(root).querySelector('li h3'))).toMatch(/^GitHub Sponsors/);
  });

  it('has one h1, "Sponsor", as the nav names it', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([]));

    const { root } = await routeHtml();

    expect(Array.from(root.querySelectorAll('h1'), textOf)).toEqual(['Sponsor']);
  });

  it('uses the shared contact destination and keeps the Email action in this tab', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([]));

    const { root } = await routeHtml();

    const mail = root.querySelectorAll('a[href^="mailto:"]');
    expect(mail.length).toBeGreaterThan(0);
    for (const link of mail) {
      expect(link).toHaveAttribute('href', profile.emailHref);
      expect(link).not.toHaveAttribute('target');
    }
  });

  it('thanks sponsors by name beside their avatars, marking who sponsors now', async () => {
    getGitHubSponsors.mockResolvedValue(
      sponsorsData([
        makeSponsor({ login: 'former', name: 'Former Friend', url: 'https://github.com/former' }),
        makeSponsor({ login: 'current', name: 'Current Friend', isActive: true }),
      ]),
    );

    const { root } = await routeHtml();

    const thanks = root.querySelector('[data-sponsor-thanks]');
    expect(textOf(thanksSection(root).querySelector('h2'))).toBe('Thank you');
    const names = Array.from(thanks?.querySelectorAll('li a[href]') ?? [], (link) =>
      textOf(link).replace(/\s*\(opens in a new tab\)$/, ''),
    );
    expect(names).toEqual(['Current Friend', 'Former Friend']);
    expect(thanks?.querySelector('a[href="https://github.com/former"]')).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(thanks?.querySelectorAll('img')).toHaveLength(2);
    expect(textOf(thanks)).toContain('now');
  });

  it('introduces a past sponsor as past when nobody sponsors now, right above the name', async () => {
    getGitHubSponsors.mockResolvedValue(
      sponsorsData([
        makeSponsor({ login: 'former', name: 'Former Friend', url: 'https://github.com/former' }),
      ]),
    );

    const { root } = await routeHtml();

    const thanks = root.querySelector('[data-sponsor-thanks]');
    expect(textOf(thanks?.querySelector('p'))).toBe('No one sponsors right now. Past sponsors:');
    expect(textOf(thanks)).not.toContain('None right now');
    expect(textOf(thanks?.querySelector('li'))).toMatch(/^Former Friend/);
    expect(textOf(thanks?.querySelector('li'))).not.toContain('now');
  });

  it('describes the page truthfully with or without a current sponsor', () => {
    expect(metadata.description).toBe(
      'Ways to support my open-source work and educational content, with thanks to everyone who has sponsored it.',
    );
    expect(metadata.description).not.toMatch(/current sponsors/i);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });

  // That the two labels line up on a wide page is measured in e2e/journeys/sponsor.spec.ts.
  it('labels the thank-you column as its own section, in every state', () => {
    const states: readonly (GitHubSponsorsData | null)[] = [
      sponsorsData([makeSponsor()]),
      sponsorsData([]),
      null,
    ];
    for (const data of states) {
      const root = viewHtml(DEFAULT_SPONSOR_OPTIONS, data);
      const section = thanksSection(root);
      const label = section.querySelector(':scope > h2');

      expect(textOf(label)).toBe('Thank you');
      expect(section).toHaveAttribute('aria-labelledby', label?.id);
      // The label is the column's only h2: the tile and the empty states sit under it.
      expect(section.querySelectorAll('h2')).toHaveLength(1);
      expect(root.querySelector('[data-sponsor-thanks] h2')).toBeNull();
    }
  });

  it('lets the names wrap under the avatar stack instead of being squeezed beside it', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      makeSponsor({ login: `friend-${index}`, name: `Friend Number ${index}` }),
    );
    const root = viewHtml(DEFAULT_SPONSOR_OPTIONS, sponsorsData(many));

    const names = root.querySelector<HTMLElement>('[data-sponsor-thanks] ul');
    const row = names?.parentElement;
    expect(names?.querySelectorAll('li')).toHaveLength(9);
    expect(row?.className.split(' ')).toContain('flex-wrap');
    // The names ask for a readable width; without it the row wraps them under the circles.
    expect(names?.className.split(' ')).toEqual(expect.arrayContaining(['grow', 'basis-48']));
  });

  it('covers a failed avatar with its own surface, so no broken-image glyph shows', () => {
    const root = viewHtml(DEFAULT_SPONSOR_OPTIONS, sponsorsData([makeSponsor()]));

    const classes = root.querySelector('[data-sponsor-thanks] img')?.className.split(' ') ?? [];
    expect(classes).toEqual(
      expect.arrayContaining([
        'relative',
        'overflow-hidden',
        'before:absolute',
        'before:inset-0',
        'before:bg-surface-2',
      ]),
    );
  });

  it('says nobody has sponsored yet in one quiet empty state, not a large card', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([]));

    const { root } = await routeHtml();

    const empty = thanksSection(root).querySelector('[data-state="empty"]');
    expect(textOf(empty?.querySelector('h3'))).toBe('No sponsors yet');
    expect(root.querySelector('[data-sponsor-thanks]')).toBeNull();
  });

  it('words a GitHub failure, offers a retry that works without JS, and reports it once', async () => {
    const error = new Error(RAW_ERROR);
    getGitHubSponsors.mockRejectedValue(error);

    const { root } = await routeHtml();

    const empty = thanksSection(root).querySelector('[data-state="empty"]');
    expect(textOf(empty?.querySelector('h3'))).toBe("Couldn't load sponsors");
    expect(empty?.querySelector('a[href="/sponsor"]')).not.toBeNull();
    expect(empty?.querySelector('button')).toBeNull();
    expect(textOf(root)).not.toMatch(/HTTP|Bad Gateway|Server Error|[{}]/);
    // The ways never depend on GitHub.
    expect(waysSection(root).querySelectorAll('li')).toHaveLength(WAY_NAMES.length);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(error, {
      context: 'load sponsors for page',
      level: 'error',
    });
  });

  it('renders the ways once the deadline passes, when GitHub never answers', async () => {
    vi.useFakeTimers();
    getGitHubSponsors.mockReturnValue(new Promise(() => {}));

    const pending = SponsorPage();
    await vi.advanceTimersByTimeAsync(SPONSORS_DEADLINE_MS);
    const root = parse(renderToString(await pending));

    expect(waysSection(root).querySelectorAll('li')).toHaveLength(WAY_NAMES.length);
    expect(textOf(root.querySelector('[data-state="empty"] h3'))).toBe("Couldn't load sponsors");
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DeadlineError' }),
      { context: 'load sponsors for page', level: 'warning' },
    );
  });

  it('ships no benefits copy and no rates', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([makeSponsor({ tier: null })]));

    const { root } = await routeHtml();

    expect(textOf(root)).not.toMatch(/Early access|Why sponsor/i);
    expect(textOf(root)).not.toMatch(/\$\s?\d|a month|\/mo\b|per month/i);
    expect(root.querySelector('[data-example-amount]')).toBeNull();
  });
});

describe('the thank-you names', () => {
  const thanksRoot = (sponsors: Sponsor[]): HTMLElement =>
    viewHtml(DEFAULT_SPONSOR_OPTIONS, sponsorsData(sponsors));

  it('underlines only the name, so nothing after the link picks up a stray underline', () => {
    const root = thanksRoot([makeSponsor({ name: 'Current Friend', isActive: true })]);
    const link = root.querySelector('[data-sponsor-thanks] li a');
    const name = link?.querySelector('[data-person-name]');

    expect(link?.className.split(' ')).not.toContain('underline');
    expect(textOf(name)).toBe('Current Friend');
    expect(name?.className.split(' ')).toEqual(
      expect.arrayContaining(['underline', 'decoration-hairline-strong', 'underline-offset-4']),
    );
    // The link's own trailing space (before its spoken words) sits outside the underlined name.
    expect(name?.nextElementSibling).toHaveAttribute('data-new-tab-arrow');
  });

  it('keeps a current sponsor\'s "now" right after the name, however long the name', () => {
    const root = thanksRoot([
      makeSponsor({ name: 'A sponsor with a really quite long display name', isActive: true }),
    ]);
    const item = root.querySelector('[data-sponsor-thanks] li');
    const link = item?.querySelector('a');
    const now = item?.lastElementChild;

    // Only the name's own words may wrap: its last word, the arrow and "now" stay one unit.
    expect(item?.className.split(' ')).toContain('whitespace-nowrap');
    expect(link?.querySelector('[data-person-name]')?.className.split(' ')).toContain(
      'whitespace-normal',
    );
    expect(textOf(now)).toBe('now');
    expect(link?.nextElementSibling).toBe(now);
  });
});

// The page with enlarged text (header actions that wrap, ways whose icon moves above the words)
// is measured in e2e/journeys/sponsor.spec.ts: jsdom lays nothing out.

describe('SponsorView switches', () => {
  it('keeps the benefits, compact and in sentence case, below the ways', () => {
    const root = viewHtml({ ...DEFAULT_SPONSOR_OPTIONS, benefits: 'keep' });

    const benefits = root.querySelector<HTMLElement>('[data-sponsor-benefits]');
    expect(textOf(benefits?.querySelector('h2'))).toBe('Why sponsor');
    expect(Array.from(benefits?.querySelectorAll('dt') ?? [], textOf)).toEqual([
      'Support open source',
      'Fuel development',
      'Early access',
      'Join the community',
    ]);
    const ways = waysSection(root);
    // DOCUMENT_POSITION_FOLLOWING: the benefits come after the ways.
    expect(benefits && ways.compareDocumentPosition(benefits) & 4).toBeTruthy();
  });
});

describe('production defaults', () => {
  it('keeps benefits dropped and has no amounts option', () => {
    expect(DEFAULT_SPONSOR_OPTIONS).toEqual({ benefits: 'drop' });
  });
});
