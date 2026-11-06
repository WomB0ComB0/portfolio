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
 * @file The home page's server tiles in every state their loaders answer: ok, stale, empty and
 * error. Each names itself with an h2, never shows a number it does not have (an error shows
 * words and a way to the source), never links to '#' or nowhere, and opens external links in a
 * new tab that it announces. Each skeleton keeps the real label and is marked busy, and each
 * async tile renders what its loader resolves.
 *
 * jsdom applies no CSS, so container-query visibility is checked as the classes that produce it,
 * and sr-only words count in accessible names. next/link is a plain anchor exposing prefetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { makeExperience, makePlace, makeProject } from '@tests/fixtures/sanity-docs';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loaders = vi.hoisted(() => ({
  loadLeetCode: vi.fn(),
  loadTyping: vi.fn(),
  loadGitHubActivity: vi.fn(),
  loadFeaturedProject: vi.fn(),
  loadLatestPlace: vi.fn(),
  loadCurrentRoles: vi.fn(),
  loadSiteCounts: vi.fn(),
}));

// t3-env validates on import; the GitHub source module reads it.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/app/_components/home/data/loaders', () => loaders);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import type { SiteCounts } from '@/app/_components/home/data/loaders';
import type { TypingTileData } from '@/app/_components/home/data/selectors';
import type { TileResult } from '@/app/_components/home/data/tile-result';
import {
  GitHubTile,
  GitHubTileSkeleton,
  GitHubTileView,
} from '@/app/_components/home/tiles/github-tile';
import {
  LeetCodeTile,
  LeetCodeTileSkeleton,
  LeetCodeTileView,
  TypingTile,
  TypingTileSkeleton,
  TypingTileView,
} from '@/app/_components/home/tiles/metric-tiles';
import {
  PlaceTile,
  PlaceTileSkeleton,
  PlaceTileView,
} from '@/app/_components/home/tiles/place-tile';
import {
  initialsOf,
  PROJECT_COVER_SIZES,
  ProjectTile,
  ProjectTileSkeleton,
  ProjectTileView,
} from '@/app/_components/home/tiles/project-tile';
import {
  RolesTile,
  RolesTileSkeleton,
  RolesTileView,
} from '@/app/_components/home/tiles/roles-tile';
import {
  SITE_INDEX_ENTRIES,
  SiteIndexTile,
  SiteIndexTileSkeleton,
  SiteIndexTileView,
  UNKNOWN_SITE_COUNTS,
} from '@/app/_components/home/tiles/site-index-tile';
import {
  asOfText,
  ExternalAnchor,
  joinMeta,
  SkeletonBar,
  TileEmpty,
  TileUnavailable,
} from '@/app/_components/home/tiles/tile-states';
import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import type { GitHubActivity } from '@/lib/api-integrations/github-activity';
import type { Experience } from '@/lib/sanity/loaders';

/** 11:07 AM in New York on Thursday, Nov 5, 2026 (EST). */
const NOW = Date.parse('2026-11-05T16:07:00Z');
const FIVE_MIN_AGO = '2026-11-05T16:02:00.000Z';
const NEW_TAB = '(opens in a new tab)';
const WEEK_MS = 7 * 24 * 60 * 60_000;

const ERROR: TileResult<never> = { status: 'error' };
const EMPTY: TileResult<never> = { status: 'empty' };
const ok = <T,>(data: T, extra: { stale?: boolean; asOf?: string } = {}): TileResult<T> => ({
  status: 'ok',
  data,
  stale: extra.stale ?? false,
  ...(extra.asOf ? { asOf: extra.asOf } : {}),
});

const LEETCODE: LeetCodeStats = {
  totalSolved: 215,
  easySolved: 120,
  mediumSolved: 80,
  hardSolved: 15,
  acceptanceRate: 61.2,
  ranking: 401_234,
};

const TYPING: TypingTileData = { best60: { wpm: 142, accuracy: 98.2 }, completedTests: 1200 };

/** 412 contributions over 12 Sunday weeks from Aug 16; the busiest is Aug 30's 61. */
const WEEK_COUNTS = [10, 20, 61, 30, 40, 50, 35, 45, 25, 55, 31, 10];
const weeksOf = (counts: readonly number[]) =>
  counts.map((count, index) => ({
    start: new Date(Date.UTC(2026, 7, 16) + index * WEEK_MS).toISOString().slice(0, 10),
    count,
  }));

const ACTIVITY: GitHubActivity = {
  weeks: weeksOf(WEEK_COUNTS),
  total: 412,
  latestCommit: {
    repo: 'WomB0ComB0/portfolio',
    repoUrl: 'https://github.com/WomB0ComB0/portfolio',
    headline: 'feat(home): the Live Console bento',
    url: 'https://github.com/WomB0ComB0/portfolio/commit/a1b2c3d4e5',
    sha: 'a1b2c3d',
    committedAt: '2026-11-05T13:07:00Z',
  },
  fetchedAt: FIVE_MIN_AGO,
};

const COVER = {
  _type: 'image',
  asset: { _ref: 'image-cover1-1600x1000-png', _type: 'reference' },
  alt: 'The Fraud Guard dashboard',
} as const;

const FEATURED = makeProject({
  title: 'Fraud Guard',
  featured: true,
  category: 'Machine Learning',
  status: 'Completed',
  startDate: '2025-02-01',
  technologies: ['Python', 'FastAPI', 'React', 'PostgreSQL', 'Docker', 'Redis'],
  image: COVER,
});

const PHOTO = {
  _type: 'image',
  asset: { _ref: 'image-stage1-800x600-jpg', _type: 'reference' },
  alt: 'The main stage',
} as const;

const PAST_PLACE = makePlace({
  name: 'NY Tech Week 2025 — Atlassian: Unleash Every Startup',
  category: 'Conference',
  startDate: '2026-10-30',
  photos: [PHOTO],
});

const roles = (count: number): Experience[] =>
  Array.from({ length: count }, (_, index) =>
    index === 0
      ? makeExperience({
          position: 'Founder & CEO',
          company: 'ResQ Systems, Inc.',
          current: true,
          startDate: '2026-03-01',
        })
      : makeExperience({ current: true }),
  );

const COUNTS: SiteCounts = { projects: 22, roles: 15, certifications: 64, places: 57 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** The rendered tile: the first element in the container. */
const tileOf = (container: HTMLElement): HTMLElement => {
  const tile = container.firstElementChild;
  if (!(tile instanceof HTMLElement)) throw new Error('nothing rendered');
  return tile;
};

/** The tile's text with its h2 left out (the label may hold a figure such as '12 weeks'). */
function textOutsideLabel(tile: HTMLElement): string {
  const copy = tile.cloneNode(true) as HTMLElement;
  for (const heading of copy.querySelectorAll('h2')) heading.remove();
  return copy.textContent ?? '';
}

/** Every URL query parameter of a next/image src, decoded through its /_next/image wrapper. */
const imageSource = (image: HTMLElement): string =>
  decodeURIComponent(image.getAttribute('src') ?? '');

const TAILWIND_SPACING_PX = 4;
/** label-mono: 12px Geist Mono (every glyph advances 0.6em) at 0.08em tracking. */
const LABEL_PX = 12;
const MONO_ADVANCE_EM = 0.6;
const LABEL_TRACKING_EM = 0.08;
/** Tailwind v4's default container sizes, in px (16px rem); globals.css overrides none of them. */
const CONTAINER_PX: Readonly<Record<string, number>> = {
  '3xs': 256,
  '2xs': 288,
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
};

const SITE_INDEX_NAMES = SITE_INDEX_ENTRIES.flatMap((entry) => [entry.one, entry.other]);

/** The first capture of the first class on `element` that `pattern` matches, or null. */
function classValueOrNull(element: Element, pattern: RegExp): string | null {
  for (const name of element.classList) {
    const value = pattern.exec(name)?.[1];
    if (value !== undefined) return value;
  }
  return null;
}

function classValue(element: Element, pattern: RegExp): string {
  const value = classValueOrNull(element, pattern);
  if (value === null) throw new Error(`no class matching ${pattern} on ${element.outerHTML}`);
  return value;
}

/** A container variant's size in px: a named one ('xl') or an arbitrary one ('[30rem]'). */
function containerPx(size: string): number {
  const rem = /^\[([\d.]+)rem\]$/.exec(size)?.[1];
  const px = rem === undefined ? CONTAINER_PX[size] : Number(rem) * 16;
  if (px === undefined) throw new Error(`unknown container size @${size}`);
  return px;
}

/** A line-height token from globals.css, e.g. --text-meta--line-height: 1.125rem. */
function lineHeightToken(name: string): string {
  const globals = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
  const value = new RegExp(`--text-${name}--line-height:\\s*([\\d.]+rem);`).exec(globals)?.[1];
  if (!value) throw new Error(`no --text-${name}--line-height in globals.css`);
  return value;
}

interface TileCase {
  readonly name: string;
  readonly element: ReactElement;
  readonly isError?: boolean;
}

const VIEW_CASES: readonly TileCase[] = [
  { name: 'LeetCode ok', element: <LeetCodeTileView result={ok(LEETCODE)} now={NOW} /> },
  {
    name: 'LeetCode stale',
    element: (
      <LeetCodeTileView result={ok(LEETCODE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
  },
  { name: 'LeetCode empty', element: <LeetCodeTileView result={EMPTY} now={NOW} /> },
  { name: 'LeetCode error', element: <LeetCodeTileView result={ERROR} />, isError: true },
  { name: 'Typing ok', element: <TypingTileView result={ok(TYPING)} now={NOW} /> },
  {
    name: 'Typing stale',
    element: <TypingTileView result={ok(TYPING, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
  },
  { name: 'Typing empty', element: <TypingTileView result={EMPTY} now={NOW} /> },
  { name: 'Typing error', element: <TypingTileView result={ERROR} />, isError: true },
  {
    name: 'GitHub ok',
    element: <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
  },
  {
    name: 'GitHub stale',
    element: (
      <GitHubTileView result={ok(ACTIVITY, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
  },
  {
    name: 'GitHub ok without a commit',
    element: (
      <GitHubTileView
        result={ok({ ...ACTIVITY, latestCommit: null }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
  },
  { name: 'GitHub empty', element: <GitHubTileView result={EMPTY} now={NOW} /> },
  { name: 'GitHub error', element: <GitHubTileView result={ERROR} now={NOW} />, isError: true },
  { name: 'Project ok', element: <ProjectTileView result={ok(FEATURED)} /> },
  {
    name: 'Project without a cover',
    element: <ProjectTileView result={ok({ ...FEATURED, image: null })} />,
  },
  {
    name: 'Project stale',
    element: (
      <ProjectTileView result={ok(FEATURED, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
  },
  { name: 'Project empty', element: <ProjectTileView result={EMPTY} /> },
  { name: 'Project error', element: <ProjectTileView result={ERROR} />, isError: true },
  { name: 'Place ok', element: <PlaceTileView result={ok(PAST_PLACE)} now={NOW} /> },
  {
    name: 'Place stale',
    element: (
      <PlaceTileView result={ok(PAST_PLACE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
  },
  { name: 'Place empty', element: <PlaceTileView result={EMPTY} now={NOW} /> },
  { name: 'Place error', element: <PlaceTileView result={ERROR} now={NOW} />, isError: true },
  {
    name: 'Roles ok',
    element: <RolesTileView result={ok({ roles: roles(3), total: 5 })} />,
  },
  {
    name: 'Roles stale',
    element: (
      <RolesTileView
        result={ok({ roles: roles(3), total: 5 }, { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
  },
  { name: 'Roles empty', element: <RolesTileView result={EMPTY} /> },
  { name: 'Roles error', element: <RolesTileView result={ERROR} />, isError: true },
  { name: 'Index ok', element: <SiteIndexTileView counts={COUNTS} /> },
  {
    name: 'Index with failed counts',
    element: <SiteIndexTileView counts={UNKNOWN_SITE_COUNTS} />,
    isError: true,
  },
];

describe('every tile view', () => {
  it.each(VIEW_CASES)('$name names itself with an h2', ({ element }) => {
    render(element);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it.each(VIEW_CASES)('$name links somewhere real, and announces new tabs', ({ element }) => {
    const { container } = render(element);
    for (const anchor of container.querySelectorAll('a')) {
      const href = anchor.getAttribute('href');
      expect(href, anchor.outerHTML).not.toBeNull();
      expect(['', '#']).not.toContain(href?.trim());
      if (/^https?:/.test(href ?? '')) expect(anchor).toHaveAttribute('target', '_blank');
      if (anchor.getAttribute('target') === '_blank') {
        expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
        expect(anchor).toHaveAccessibleName(/\(opens in a new tab\)$/);
      } else if (href?.startsWith('/')) {
        expect(anchor).toHaveAttribute('data-prefetch', 'false');
      }
    }
  });

  it.each(VIEW_CASES.filter((tile) => tile.isError))(
    '$name shows words, never a number',
    ({ element }) => {
      const { container } = render(element);
      expect(textOutsideLabel(tileOf(container))).not.toMatch(/\d/);
    },
  );
});

describe('LeetCodeTileView', () => {
  it('makes the whole tile one link to the profile, with the solved split', () => {
    render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const tile = screen.getByRole('link', { name: /^LeetCode\s*215/ });
    expect(tile).toHaveAttribute('href', 'https://leetcode.com/u/WomB0ComB0/');
    expect(tile).toHaveAttribute('target', '_blank');
    expect(within(tile).getByText('solved')).toBeInTheDocument();
    expect(
      within(tile)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Easy', 'Medium', 'Hard']);
    expect(
      within(tile)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toEqual(['120', '80', '15']);
    expect(within(tile).getByText('refreshed every 6 h')).toBeInTheDocument();
  });

  it('shows sighted readers that the tile opens a new tab, as every external link does', () => {
    render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const tile = screen.getByRole('link', { name: /^LeetCode/ });
    expect(tile.querySelector('svg[data-new-tab-arrow]')).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveAccessibleName(/\(opens in a new tab\)$/);
  });

  it('says when stale numbers were read', () => {
    render(
      <LeetCodeTileView result={ok(LEETCODE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = screen.getByRole('link', { name: /^LeetCode/ });
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(tile).toHaveTextContent(/Stale ·\s*as of Nov 5 11:02 AM ET/);
  });

  it('shows words when there is nothing solved to show', () => {
    render(<LeetCodeTileView result={EMPTY} now={NOW} />);
    expect(screen.getByText('No solved problems yet')).toBeInTheDocument();
  });

  it('is a plain tile with the error and an ordinary link to the profile', () => {
    render(<LeetCodeTileView result={ERROR} />);
    const tile = screen.getByRole('article', { name: 'LeetCode' });
    expect(within(tile).getByText('LeetCode stats unavailable')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: `LeetCode profile ${NEW_TAB}` })).toHaveAttribute(
      'href',
      'https://leetcode.com/u/WomB0ComB0/',
    );
  });
});

describe('TypingTileView', () => {
  it('shows the 60 s personal best and its accuracy, linking the profile', () => {
    render(<TypingTileView result={ok(TYPING)} now={NOW} />);
    const tile = screen.getByRole('link', { name: /^Typing\s*142/ });
    expect(tile).toHaveAttribute('href', 'https://monkeytype.com/profile/WomB0ComB0');
    expect(within(tile).getByText('wpm')).toBeInTheDocument();
    expect(within(tile).getByText('60 s personal best · 98.2% acc')).toBeInTheDocument();
    expect(tile.querySelector('svg[data-new-tab-arrow]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks a stale best with when it was read', () => {
    render(<TypingTileView result={ok(TYPING, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />);
    const tile = screen.getByRole('link', { name: /^Typing/ });
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(tile).toHaveTextContent(/Stale ·\s*60 s best · as of Nov 5 11:02 AM ET/);
  });

  it('says there is no 60 s test yet', () => {
    render(<TypingTileView result={EMPTY} now={NOW} />);
    expect(screen.getByText('No 60 s test yet')).toBeInTheDocument();
  });

  it('errors in words with a link to the profile', () => {
    render(<TypingTileView result={ERROR} />);
    expect(screen.getByText('Typing stats unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Monkeytype profile ${NEW_TAB}` })).toBeInTheDocument();
  });
});

describe('GitHubTileView', () => {
  it('shows the total, the latest commit as the tile link, and its freshness', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');
    expect(
      screen.getByRole('heading', { level: 2, name: 'GitHub · 12 weeks' }),
    ).toBeInTheDocument();
    expect(within(tile).getByText('contributions').parentElement).toHaveTextContent(
      '412contributions',
    );
    expect(within(tile).getByText('portfolio · a1b2c3d · 3 h ago')).toBeInTheDocument();
    const commit = within(tile).getByRole('link', {
      name: `feat(home): the Live Console bento (latest commit on GitHub) ${NEW_TAB}`,
    });
    expect(commit).toHaveAttribute('href', ACTIVITY.latestCommit?.url);
    expect(commit).toHaveAttribute('data-tile-link');
    expect(within(tile).getByText('updated 5 min ago')).toHaveAttribute('datetime', FIVE_MIN_AGO);
  });

  // A two-line headline used to be clamped together with the arrow after it, hiding the tile's
  // only visible new-tab cue.
  it('clamps only the commit headline, so its new-tab arrow is never cut off', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    const commit = within(tile).getByRole('link', { name: /latest commit on GitHub/ });
    const headline = within(commit).getByText(ACTIVITY.latestCommit?.headline ?? '');
    const arrow = commit.querySelector('[data-new-tab-arrow]');

    expect(headline).not.toBe(commit);
    expect(headline).toHaveClass('line-clamp-1', 'min-w-0');
    expect(arrow).not.toBeNull();
    expect(headline.contains(arrow)).toBe(false);
    // The headline and the arrow are items of one row; nothing around them clamps.
    expect(commit).toHaveClass('flex', 'items-baseline');
    for (let node: HTMLElement | null = commit; node && node !== tile; node = node.parentElement) {
      expect(node.className, node.outerHTML).not.toMatch(/line-clamp/);
    }
  });

  it('says what the sparkline shows, for screen readers', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    expect(container.querySelector('[data-sparkline]')).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByText('412 contributions in the last 12 weeks; busiest week 61 (week of Aug 30).'),
    ).toHaveClass('sr-only');
  });

  it('names the earliest of two equally busy weeks', () => {
    const tied = WEEK_COUNTS.map((count, index) => (index === 9 ? 61 : count));
    render(
      <GitHubTileView
        result={ok({ ...ACTIVITY, weeks: weeksOf(tied), total: 418 }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    expect(
      screen.getByText('418 contributions in the last 12 weeks; busiest week 61 (week of Aug 30).'),
    ).toBeInTheDocument();
  });

  it('links the profile instead of a commit that has no URL', () => {
    const latestCommit = { ...ACTIVITY.latestCommit, url: ' ' } as GitHubActivity['latestCommit'];
    render(
      <GitHubTileView
        result={ok({ ...ACTIVITY, latestCommit }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/WomB0ComB0',
    );
    expect(screen.queryByText(/the Live Console bento/)).toBeNull();
  });

  it('leaves the busiest week out when no week has a contribution', () => {
    render(
      <GitHubTileView
        result={ok(
          { ...ACTIVITY, weeks: weeksOf(WEEK_COUNTS.map(() => 0)), total: 0 },
          { asOf: FIVE_MIN_AGO },
        )}
        now={NOW}
      />,
    );
    expect(screen.getByText('0 contributions in the last 12 weeks.')).toBeInTheDocument();
  });

  it('shows stale activity as of an absolute New York time', () => {
    render(<GitHubTileView result={ok(ACTIVITY, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />);
    expect(screen.getByText('as of Nov 5 11:02 AM ET')).toBeInTheDocument();
    expect(screen.queryByText(/updated/)).toBeNull();
  });

  it('links the label to the profile when there is no commit', () => {
    render(
      <GitHubTileView
        result={ok({ ...ACTIVITY, latestCommit: null }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/WomB0ComB0',
    );
    expect(screen.queryByText(/a1b2c3d/)).toBeNull();
  });

  it('keeps the sparkline place dashed and links the profile on error', () => {
    const { container } = render(<GitHubTileView result={ERROR} now={NOW} />);
    const tile = tileOf(container);
    expect(tile).not.toHaveAttribute('data-linked-tile');
    expect(within(tile).getByText('GitHub activity unavailable')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: `GitHub profile ${NEW_TAB}` })).toHaveAttribute(
      'href',
      'https://github.com/WomB0ComB0',
    );
    expect(tile.querySelector('.border-dashed')).toHaveAttribute('aria-hidden', 'true');
    expect(tile.querySelector('[data-sparkline]')).toBeNull();
  });

  it('says there is no public activity yet, without an alert, and links the profile', () => {
    const { container } = render(<GitHubTileView result={EMPTY} now={NOW} />);
    const tile = tileOf(container);
    expect(within(tile).getByText('No public activity yet')).toBeInTheDocument();
    expect(tile.querySelector('.text-down')).toBeNull();
    expect(within(tile).getByRole('link', { name: `GitHub profile ${NEW_TAB}` })).toHaveAttribute(
      'href',
      'https://github.com/WomB0ComB0',
    );
  });
});

describe('ProjectTileView', () => {
  it('shows the cover, title link, description, up to four chips and the meta', () => {
    const { container } = render(<ProjectTileView result={ok(FEATURED)} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');
    const cover = within(tile).getByRole('img', { name: 'The Fraud Guard dashboard' });
    expect(cover).toHaveAttribute('loading', 'lazy');
    expect(cover).toHaveAttribute('sizes', PROJECT_COVER_SIZES);
    const source = imageSource(cover);
    expect(source).toContain('cdn.sanity.io/images/test/test/cover1-1600x1000.png?');
    for (const param of ['w=1200', 'h=750', 'fit=crop', 'auto=format']) {
      expect(source).toContain(param);
    }
    const title = within(tile).getByRole('heading', { level: 3 });
    expect(within(title).getByRole('link', { name: 'Fraud Guard' })).toHaveAttribute(
      'href',
      `/projects/${encodeURIComponent(FEATURED._id)}`,
    );
    expect(within(tile).getByText(FEATURED.description)).toHaveClass('line-clamp-2');
    expect(
      within(tile)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['Python', 'FastAPI', 'React', 'PostgreSQL']);
    expect(within(tile).getByText('Machine Learning · Completed · 2025')).toBeInTheDocument();
  });

  it('draws a typographic cover without an image, never "No Image Available"', () => {
    const { container } = render(<ProjectTileView result={ok({ ...FEATURED, image: null })} />);
    const cover = container.querySelector('[data-cover="typographic"]');
    expect(cover).toHaveAttribute('aria-hidden', 'true');
    expect(cover).toHaveTextContent('FG');
    expect(cover).toHaveTextContent('Machine Learning');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toMatch(/no image/i);
  });

  it('falls back to the typographic cover when the image reference is malformed', () => {
    const broken = { ...COVER, asset: { _ref: 'not-an-image-ref', _type: 'reference' as const } };
    const { container } = render(<ProjectTileView result={ok({ ...FEATURED, image: broken })} />);
    expect(container.querySelector('[data-cover="typographic"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it.each([
    [EMPTY, 'No featured project yet'],
    [ERROR, 'Projects unavailable'],
  ] as const)('says the %o message with a way to every project', (result, message) => {
    render(<ProjectTileView result={result} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
  });

  it('encodes the document id in the link', () => {
    render(<ProjectTileView result={ok({ ...FEATURED, _id: 'fraud/guard v2' })} />);
    expect(screen.getByRole('link', { name: 'Fraud Guard' })).toHaveAttribute(
      'href',
      '/projects/fraud%2Fguard%20v2',
    );
  });

  it('says which day a stale project’s list is from, and nothing more when fresh', () => {
    const { container } = render(
      <ProjectTileView result={ok(FEATURED, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(
      within(tile).getByText('Machine Learning · Completed · 2025 · as of Nov 5'),
    ).toHaveAttribute('data-dated');
    cleanup();

    render(<ProjectTileView result={ok(FEATURED)} now={NOW} />);
    expect(screen.queryByText(/as of/)).toBeNull();
  });

  it('takes up to two initials from the title', () => {
    expect(initialsOf('Fraud Guard')).toBe('FG');
    expect(initialsOf('grepo')).toBe('G');
    expect(initialsOf('FOIA-Stream data tools')).toBe('FS');
    expect(initialsOf('')).toBe('');
  });
});

describe('PlaceTileView', () => {
  it('links the latest place by name and says where and when', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');
    expect(screen.getByRole('heading', { level: 2, name: 'Last place' })).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: PAST_PLACE.name })).toHaveAttribute(
      'href',
      `/places/${encodeURIComponent(PAST_PLACE._id)}`,
    );
    expect(within(tile).getByText('Conference · Oct 30 · 6 d ago')).toBeInTheDocument();
    expect(within(tile).getByRole('heading', { level: 3 })).toHaveClass('line-clamp-2');
  });

  it('says which day a stale place’s list is from', () => {
    const { container } = render(
      <PlaceTileView result={ok(PAST_PLACE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(within(tile).getByText('Conference · Oct 30 · 6 d ago · as of Nov 5')).toBeVisible();
  });

  it('gives a place from another year its date once, with the year', () => {
    render(<PlaceTileView result={ok({ ...PAST_PLACE, startDate: '2025-10-30' })} now={NOW} />);
    expect(screen.getByText('Conference · Oct 30, 2025')).toBeInTheDocument();
  });

  it('encodes the document id in the link', () => {
    render(<PlaceTileView result={ok({ ...PAST_PLACE, _id: 'tech/week 25' })} now={NOW} />);
    expect(screen.getByRole('link', { name: PAST_PLACE.name })).toHaveAttribute(
      'href',
      '/places/tech%2Fweek%2025',
    );
  });

  it('shows the photo thumbnail from 18rem and the coordinates below it', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const thumbnail = within(tileOf(container)).getByRole('img', { name: 'The main stage' });
    expect(thumbnail).toHaveClass('hidden', '@2xs:block');
    const source = imageSource(thumbnail);
    expect(source).toContain('stage1-800x600.jpg?');
    for (const param of ['w=144', 'h=144', 'fit=crop']) expect(source).toContain(param);
    expect(screen.getByText('40.71° N, 74.01° W')).toHaveClass('@2xs:hidden');
  });

  it('always shows the coordinates for a place without photos', () => {
    render(<PlaceTileView result={ok({ ...PAST_PLACE, photos: null })} now={NOW} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('40.71° N, 74.01° W')).not.toHaveClass('@2xs:hidden');
  });

  it('says "Here now" with an amber dot while the visit is on', () => {
    const { container } = render(
      <PlaceTileView result={ok({ ...PAST_PLACE, startDate: '2026-11-05' })} now={NOW} />,
    );
    const label = screen.getByRole('heading', { level: 2, name: 'Here now' });
    expect(label).toHaveClass('text-ongoing');
    expect(label.querySelector('[data-status-dot]')).toHaveAttribute('data-tone', 'ongoing');
    expect(within(tileOf(container)).getByText('Conference · Nov 5')).toBeInTheDocument();
  });

  // The visual spec masks [data-dated] only, so the rest of the place tile is still compared.
  it.each([
    ['a past visit', PAST_PLACE.startDate, 'Last place', 'Conference · Oct 30 · 6 d ago'],
    ['a visit still on', '2026-11-05', 'Here now', 'Conference · Nov 5'],
  ])(
    'marks only the words worded from today data-dated, for %s',
    (_case, startDate, label, when) => {
      const { container } = render(
        <PlaceTileView result={ok({ ...PAST_PLACE, startDate })} now={NOW} />,
      );

      expect(
        [...container.querySelectorAll('[data-dated]')].map((node) => node.textContent),
      ).toEqual([label, when]);
    },
  );

  it.each([
    [EMPTY, 'No places yet'],
    [ERROR, 'Places unavailable'],
  ] as const)('says the %o message with a way to every place', (result, message) => {
    render(<PlaceTileView result={result} now={NOW} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All places' })).toHaveAttribute('href', '/places');
  });
});

describe('RolesTileView', () => {
  it('links each shown role to its page with the company and start month', () => {
    const shown = roles(3);
    render(<RolesTileView result={ok({ roles: shown, total: 5 })} />);
    const founder = screen.getByRole('link', {
      name: 'Founder & CEO ResQ Systems, Inc. · since Mar 2026',
    });
    expect(founder).toHaveAttribute(
      'href',
      `/experience/${encodeURIComponent(shown[0]?._id ?? '')}`,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).not.toHaveClass('hidden');
    expect(items[2]).toHaveClass('hidden', '@xs:block');
  });

  it('counts the roles not on screen: +2 more from 20rem, +3 below it, for 5 roles', () => {
    render(<RolesTileView result={ok({ roles: roles(3), total: 5 })} />);
    const wide = screen.getByRole('link', { name: '+2 more current roles' });
    const narrow = screen.getByRole('link', { name: '+3 more current roles' });
    expect(wide).toHaveAttribute('href', '/experience');
    expect(wide).toHaveClass('hidden', '@xs:inline');
    expect(narrow).toHaveClass('@xs:hidden');
  });

  it('shows a count below 20rem only, when every role fits above it', () => {
    render(<RolesTileView result={ok({ roles: roles(3), total: 3 })} />);
    expect(screen.getByRole('link', { name: '+1 more current roles' })).toHaveClass('@xs:hidden');
    expect(screen.getAllByRole('link', { name: /more/ })).toHaveLength(1);
  });

  it('shows one count at every width when both widths hide the same roles', () => {
    render(<RolesTileView result={ok({ roles: roles(2), total: 4 })} />);
    const links = screen.getAllByRole('link', { name: /more/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('+2 more current roles');
    expect(links[0]?.className).not.toMatch(/hidden/);
  });

  it('encodes the document id in each role link', () => {
    const [founder] = roles(1);
    if (!founder) throw new Error('no role');
    render(<RolesTileView result={ok({ roles: [{ ...founder, _id: 'resq/ceo 1' }], total: 1 })} />);
    expect(screen.getByRole('link', { name: /^Founder & CEO/ })).toHaveAttribute(
      'href',
      '/experience/resq%2Fceo%201',
    );
  });

  it('shows no count when every role is listed at every width', () => {
    render(<RolesTileView result={ok({ roles: roles(2), total: 2 })} />);
    expect(screen.queryByRole('link', { name: /more/ })).toBeNull();
  });

  it('says which day stale roles are from, under the count, at the tile’s foot', () => {
    const { container } = render(
      <RolesTileView
        result={ok({ roles: roles(3), total: 5 }, { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    const asOf = within(tile).getByText('as of Nov 5');
    expect(asOf).toHaveAttribute('data-dated');
    // The '+N more' line already sits at the foot (mt-auto); the day goes right under it.
    expect(asOf).toHaveClass('mt-0');
    expect(asOf).not.toHaveClass('mt-auto');
  });

  it('pushes the stale day to the foot itself when no count is shown', () => {
    render(
      <RolesTileView
        result={ok({ roles: roles(2), total: 2 }, { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    expect(screen.getByText('as of Nov 5')).toHaveClass('mt-auto');
  });

  it('prints no day for fresh roles, or for stale ones whose load time is unknown', () => {
    const { container } = render(
      <RolesTileView result={ok({ roles: roles(2), total: 2 })} now={NOW} />,
    );
    expect(tileOf(container)).not.toHaveAttribute('data-state');
    cleanup();

    render(<RolesTileView result={ok({ roles: roles(2), total: 2 }, { stale: true })} now={NOW} />);
    expect(screen.queryByText(/as of/)).toBeNull();
  });

  it.each([
    [EMPTY, 'No current roles listed'],
    [ERROR, 'Roles unavailable'],
  ] as const)('says the %o message with a way to the experience page', (result, message) => {
    render(<RolesTileView result={result} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All experience' })).toHaveAttribute(
      'href',
      '/experience',
    );
  });
});

describe('SiteIndexTileView', () => {
  it('names each cell by its count and section, e.g. "22 projects"', () => {
    render(<SiteIndexTileView counts={COUNTS} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Site index' })).toHaveClass('sr-only');
    for (const [name, href] of [
      ['22 projects', '/projects'],
      ['15 roles', '/experience'],
      ['64 certifications', '/certifications'],
      ['57 places', '/places'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(screen.getByRole('list')).toHaveClass('grid-cols-2', '@xl:grid-cols-4');
  });

  it('gives the visible "Index" the semibold weight of the h2 tile labels', () => {
    render(<SiteIndexTileView counts={COUNTS} />);
    const visible = screen.getByText('Index');
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    // label-mono sets no weight; the base style makes h2s semibold and a <p> normal.
    expect(visible.tagName).not.toBe('H2');
    expect(visible).toHaveClass('label-mono', 'font-semibold');
  });

  // At a 320 px viewport the 2x2 'CERTIFICATIONS' cell got 114 px of text in 101.5 px; and four
  // across from a 30rem tile, a cell had 95 px. This models each cell's content box for every
  // tile width from 320 px up, from the classes the tile renders and Tailwind's container sizes.
  it('fits every section name inside its cell at every tile width from a 320 px viewport', () => {
    render(<SiteIndexTileView counts={COUNTS} />);
    const list = screen.getByRole('list');
    const link = screen.getByRole('link', { name: '64 certifications' });
    const name = within(link).getByText('certifications');

    const fourAcrossFrom = containerPx(classValue(list, /^@(\w+|\[[\d.]+rem\]):grid-cols-4$/));
    expect(link).toHaveClass('px-3');
    // Narrow-tile adjustments, each optional: below its container size, a cell's own padding
    // and a name without tracking.
    const paddingSize = classValueOrNull(link, /^@max-(\w+):px-[\d.]+$/);
    const narrowPaddingBelow = paddingSize === null ? 0 : containerPx(paddingSize);
    const narrowPadding =
      Number(classValueOrNull(link, /^@max-\w+:px-([\d.]+)$/) ?? 3) * TAILWIND_SPACING_PX;
    const trackingSize = classValueOrNull(name, /^@max-(\w+):tracking-normal$/);
    const untrackedBelow = trackingSize === null ? 0 : containerPx(trackingSize);

    const longest = Math.max(...SITE_INDEX_NAMES.map((word) => word.length));
    const misfits: string[] = [];
    // 254 px: a 320 px viewport's strip tile inside its border and p-4; 700 px is past the widest.
    for (let tile = 254; tile <= 700; tile += 1) {
      const columns = tile >= fourAcrossFrom ? 4 : 2;
      const padding = tile < narrowPaddingBelow ? narrowPadding : 3 * TAILWIND_SPACING_PX;
      const tracking = tile < untrackedBelow ? 0 : LABEL_TRACKING_EM;
      // The list's 1px border on each side, and a 1px hairline between cells.
      const cell = (tile - 2 - (columns - 1)) / columns - 2 * padding;
      const text = longest * (MONO_ADVANCE_EM + tracking) * LABEL_PX;
      if (text > cell) misfits.push(`${tile} px tile: ${text.toFixed(1)} px in ${cell.toFixed(1)}`);
    }
    expect(misfits).toEqual([]);
  });

  it('shows the section name without digits when its count failed', () => {
    render(<SiteIndexTileView counts={{ ...COUNTS, roles: null }} />);
    const rolesLink = screen.getByRole('link', { name: 'roles' });
    expect(rolesLink.textContent).not.toMatch(/\d/);
    expect(screen.getByRole('link', { name: '22 projects' })).toBeInTheDocument();
  });

  it('uses the singular for one entry', () => {
    render(<SiteIndexTileView counts={{ ...COUNTS, places: 1 }} />);
    expect(screen.getByRole('link', { name: '1 place' })).toBeInTheDocument();
  });
});

describe('skeletons', () => {
  it.each([
    ['LeetCode', <LeetCodeTileSkeleton key="leetcode" />],
    ['Typing', <TypingTileSkeleton key="typing" />],
    ['GitHub · 12 weeks', <GitHubTileSkeleton key="github" />],
    ['Featured project', <ProjectTileSkeleton key="project" />],
    ['Last place', <PlaceTileSkeleton key="place" />],
    ['Current roles', <RolesTileSkeleton key="roles" />],
    ['Site index', <SiteIndexTileSkeleton key="index" />],
  ] as const)('%s keeps its real label and is busy', (label, element) => {
    const { container } = render(element);
    expect(tileOf(container)).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 2, name: label })).toBeInTheDocument();
    expect(screen.getByText(/^Loading/)).toHaveClass('sr-only');
    expect(container.querySelector('a')).toBeNull();
    expect(textOutsideLabel(tileOf(container))).not.toMatch(/\d/);
  });

  // The old skeleton's 40px, 16px and 12px bars were about 54px shorter than the loaded tile above
  // a 40rem tile, so every row below jumped when GitHub answered.
  it('GitHub reserves the loaded lines: the figure, the commit, the meta', () => {
    const loaded = tileOf(
      render(<GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />).container,
    );
    const figure = within(loaded).getByText('contributions').parentElement;
    const commitMeta = within(loaded).getByText('portfolio · a1b2c3d · 3 h ago');
    const headline = within(loaded).getByRole('link', { name: /latest commit/ }).parentElement;
    const meta = within(loaded).getByText('updated 5 min ago').parentElement;
    expect(commitMeta).toHaveClass('text-meta');
    expect(headline).toHaveClass('mt-1', 'text-body-sm');
    expect(meta).toHaveClass('mt-auto', 'text-meta');
    cleanup();

    const skeleton = tileOf(render(<GitHubTileSkeleton />).container);
    // The figure's own element (its type size changes with the tile) holding a 1em bar.
    const placeholder = skeleton.querySelector('p');
    expect(placeholder?.className).toBe(figure?.className);
    expect(placeholder?.firstElementChild).toHaveClass('h-[1em]');
    // Boxes the heights of the loaded lines, from the line-height tokens.
    const metaLine = `h-[${lineHeightToken('meta')}]`;
    const bodyLine = `h-[${lineHeightToken('body-sm')}]`;
    const lines = [...skeleton.querySelectorAll(`[class*="h-["]`)].filter(
      (box) => box.classList.contains(metaLine) || box.classList.contains(bodyLine),
    );
    expect(
      lines.map((box) => box.className.split(' ').filter((c) => /^(?:mt-|h-\[)/.test(c))),
    ).toEqual([[metaLine], ['mt-1', bodyLine], ['mt-auto', metaLine]]);
  });

  // The legend wraps to two lines in the wide layout's 3-column tile and stacks to three below a
  // 12rem bar; a one-line placeholder let the rows below jump when LeetCode answered.
  it('LeetCode reserves a legend that wraps where the loaded one does', () => {
    const loaded = render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />).container;
    const loadedBar = loaded.querySelector('[data-segment-bar]');
    const loadedLegend = loadedBar?.querySelector('dl');
    if (!(loadedBar && loadedLegend)) throw new Error('the loaded tile has no segment bar legend');
    const loadedClasses = {
      legend: loadedLegend.className,
      items: [...loadedLegend.children].map((item) => item.className),
      terms: [...loadedLegend.querySelectorAll('dt')].map((term) => term.className),
    };
    cleanup();

    const { container } = render(<LeetCodeTileSkeleton />);
    const placeholder = container.querySelector('[data-segment-bar-placeholder]');
    const legend = placeholder?.querySelector('dl');
    if (!(placeholder && legend)) throw new Error('the skeleton has no legend placeholder');

    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    // Both are the container the legend's @max-[12rem] stacking measures.
    expect(placeholder).toHaveClass('@container');
    expect(loadedBar).toHaveClass('@container');
    expect(legend.className).toBe(loadedClasses.legend);
    expect([...legend.children].map((item) => item.className)).toEqual(loadedClasses.items);
    expect([...legend.querySelectorAll('dt')].map((term) => term.className)).toEqual(
      loadedClasses.terms,
    );
    expect([...legend.querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
    // Each amount's box is one text-label line (1rem) with a bar three digits wide.
    expect(lineHeightToken('label')).toBe('1rem');
    for (const amount of legend.querySelectorAll('dd')) {
      expect(amount).toHaveClass('h-4');
      expect(amount.firstElementChild).toHaveClass('w-[3ch]');
    }
  });
});

describe('tile states', () => {
  it('marks an error with a decorative alert glyph in the down colour, beside words', () => {
    const { container } = render(<TileUnavailable message="Places unavailable" />);
    const glyph = container.querySelector('svg');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph).toHaveClass('text-down');
    expect(screen.getByText('Places unavailable')).toBeInTheDocument();
  });

  it('gives the empty state no alert glyph', () => {
    const { container } = render(<TileEmpty message="No places yet" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each([
    ['a # href', { href: '#', linkLabel: 'All places' }],
    ['a blank href', { href: '  ', linkLabel: 'All places' }],
    ['no link words', { href: '/places' }],
  ] as const)('renders no link for %s', (_, link) => {
    render(<TileUnavailable message="Places unavailable" {...link} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders an external link with nowhere to go as plain text', () => {
    render(<ExternalAnchor href="#">GitHub</ExternalAnchor>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('GitHub').tagName).toBe('SPAN');
  });

  it('hides skeleton bars from assistive tech', () => {
    const { container } = render(<SkeletonBar className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('prints nothing for an "as of" time it cannot read', () => {
    expect(asOfText('not a date', NOW)).toBe('');
    expect(asOfText(FIVE_MIN_AGO, NOW)).toBe('as of Nov 5 11:02 AM ET');
  });

  it('joins only the meta parts that have words', () => {
    expect(joinMeta(['Conference', null, '', undefined, 'Oct 30'])).toBe('Conference · Oct 30');
  });
});

describe('async tiles', () => {
  it('render what their loaders resolve', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    loaders.loadLeetCode.mockResolvedValue(ok(LEETCODE));
    loaders.loadTyping.mockResolvedValue(ok(TYPING));
    loaders.loadGitHubActivity.mockResolvedValue(ok(ACTIVITY, { asOf: FIVE_MIN_AGO }));
    loaders.loadFeaturedProject.mockResolvedValue(ok(FEATURED));
    loaders.loadLatestPlace.mockResolvedValue(ok(PAST_PLACE));
    loaders.loadCurrentRoles.mockResolvedValue(ok({ roles: roles(1), total: 1 }));
    loaders.loadSiteCounts.mockResolvedValue(COUNTS);

    const tiles = {
      leetcode: await LeetCodeTile(),
      typing: await TypingTile(),
      github: await GitHubTile(),
      project: await ProjectTile(),
      place: await PlaceTile(),
      roles: await RolesTile(),
      index: await SiteIndexTile(),
    };
    render(
      <div>
        {Object.entries(tiles).map(([name, tile]) => (
          <div key={name}>{tile}</div>
        ))}
      </div>,
    );

    expect(screen.getByRole('link', { name: /^LeetCode\s*215/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Typing\s*142/ })).toBeInTheDocument();
    expect(screen.getByText('portfolio · a1b2c3d · 3 h ago')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fraud Guard' })).toBeInTheDocument();
    expect(screen.getByText('Conference · Oct 30 · 6 d ago')).toBeInTheDocument();
    expect(screen.getByText('Founder & CEO')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '22 projects' })).toBeInTheDocument();
    for (const load of Object.values(loaders)) expect(load).toHaveBeenCalledTimes(1);
  });
});
