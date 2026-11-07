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
 * new tab that it announces. Each skeleton keeps the real label, is marked busy, and holds the
 * loaded tile's lines, so the tile landing moves nothing; each async tile renders what its loader
 * resolves.
 *
 * The copy is the owner's final copy (bento lab brief 1.1) in the refined type: sentence-case
 * labels (tile-label), Geist figures by the tile's size class (figure-lg/md/sm), meta lines in
 * tile-meta. Tiles hug their content: nothing stretches them or pushes a line to their foot.
 *
 * jsdom applies no CSS, so container-query behaviour is checked as the classes that produce it,
 * and sr-only words count in accessible names. next/link is a plain anchor exposing prefetch.
 * Testing Library's text matchers see a no-break space as a space.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { makeExperience, makePlace, makeProject } from '@tests/fixtures/sanity-docs';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

const loaders = vi.hoisted(() => ({
  loadLeetCode: vi.fn(),
  loadTyping: vi.fn(),
  loadGitHubActivity: vi.fn(),
  loadProjectPick: vi.fn(),
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
import type { ProjectPick, TypingTileData } from '@/app/_components/home/data/selectors';
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
  typingMeta,
} from '@/app/_components/home/tiles/metric-tiles';
import {
  PlaceTile,
  PlaceTileSkeleton,
  PlaceTileView,
} from '@/app/_components/home/tiles/place-tile';
import {
  initialsOf,
  PROJECT_COVER_SIZES,
  PROJECT_SUBTITLE_FALLBACK,
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
  SiteIndexTile,
  SiteIndexTileSkeleton,
  SiteIndexTileView,
  UNKNOWN_SITE_COUNTS,
} from '@/app/_components/home/tiles/site-index-tile';
import {
  asOfText,
  ExternalAnchor,
  figureShape,
  joinMeta,
  META_SEPARATOR,
  SkeletonBar,
  TileEmpty,
  TileLabel,
  type TileLabelProps,
  TileUnavailable,
} from '@/app/_components/home/tiles/tile-states';
import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import type { GitHubActivity } from '@/lib/api-integrations/github-activity';
import type { Experience, Project } from '@/lib/sanity/loaders';

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
    headline: 'feat(home): the Live Console bento (#604)',
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

/** The cover with Studio's hotspot on the logo, low in the frame. */
const COVER_WITH_HOTSPOT = { ...COVER, hotspot: { x: 0.5, y: 0.75, width: 0.3, height: 0.2 } };

const FEATURED = makeProject({
  title: 'Fraud Guard - AI-Powered Transaction Monitoring',
  description: 'Watches every card payment and flags the ones that look like fraud.',
  featured: true,
  category: 'Machine Learning',
  status: 'Completed',
  startDate: '2025-02-01',
  technologies: ['Python', 'FastAPI', 'React', 'PostgreSQL', 'Docker', 'Redis'],
  image: COVER,
});

/** The day before NOW's, in New York. */
const YESTERDAY = '2026-11-04';

/** `project` as the featured pick, chosen without GitHub. */
const featuredPick = (project: Project): ProjectPick => ({ source: 'featured', project });

/** `project` as his latest work: he last committed to its repository on `lastCommitDay`. */
const activePick = (project: Project, lastCommitDay = YESTERDAY): ProjectPick => ({
  source: 'activity',
  project,
  repo: 'WomB0ComB0/fraud-guard',
  lastCommitDay,
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

/** `count` current roles: the first is the hero's (Founder & CEO, ResQ Systems, Inc.). */
const roles = (count: number): Experience[] =>
  Array.from({ length: count }, (_, index) =>
    index === 0
      ? makeExperience({
          position: 'Founder & CEO',
          company: 'ResQ Systems, Inc.',
          current: true,
          startDate: '2026-03-01',
        })
      : makeExperience({ current: true, startDate: '2024-01-15' }),
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

/** `node`'s text without the parts `selector` matches, its runs of spaces made one. */
function textWithout(node: Element, selector: string): string {
  const copy = node.cloneNode(true) as Element;
  for (const part of copy.querySelectorAll(selector)) part.remove();
  return (copy.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

/** The tile's text with its h2 left out. */
const textOutsideLabel = (tile: HTMLElement): string => textWithout(tile, 'h2');

/** What a sighted reader sees of `node`: its text without the sr-only words. */
const seenText = (node: Element): string => textWithout(node, '.sr-only');

/** What a screen reader reads of `node`: its text without the aria-hidden parts. */
const heardText = (node: Element): string => textWithout(node, '[aria-hidden="true"]');

/** Every URL query parameter of a next/image src, decoded through its /_next/image wrapper. */
const imageSource = (image: Element): string => decodeURIComponent(image.getAttribute('src') ?? '');

/** The element's children that take space: not the sr-only words. */
const shownChildren = (element: Element | null | undefined): Element[] =>
  [...(element?.children ?? [])].filter((child) => !child.classList.contains('sr-only'));

/** Classes that stretch a tile or push a line to its foot: none, now that tiles hug. */
const STRETCH = '.h-full, .mt-auto, [class*="min-h-full"]';

const expectHugs = (tile: HTMLElement): void => {
  expect(tile).not.toHaveClass('h-full');
  expect(tile.querySelector(STRETCH)).toBeNull();
};

/**
 * The tile state contract (tile-states.tsx): a root not showing its reference content says why
 * in data-state; 'ready' is the reference content.
 */
type TileState = 'ready' | 'loading' | 'error' | 'empty' | 'stale';

interface TileCase {
  readonly name: string;
  readonly element: ReactElement;
  /** The root's data-state. */
  readonly state: Exclude<TileState, 'loading'>;
  readonly isError?: boolean;
}

const VIEW_CASES: readonly TileCase[] = [
  {
    name: 'LeetCode ok',
    element: <LeetCodeTileView result={ok(LEETCODE)} now={NOW} />,
    state: 'ready',
  },
  {
    name: 'LeetCode stale',
    element: (
      <LeetCodeTileView result={ok(LEETCODE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
    state: 'stale',
  },
  {
    name: 'LeetCode empty',
    element: <LeetCodeTileView result={EMPTY} now={NOW} />,
    state: 'empty',
  },
  {
    name: 'LeetCode error',
    element: <LeetCodeTileView result={ERROR} />,
    state: 'error',
    isError: true,
  },
  { name: 'Typing ok', element: <TypingTileView result={ok(TYPING)} now={NOW} />, state: 'ready' },
  {
    name: 'Typing stale',
    element: <TypingTileView result={ok(TYPING, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    state: 'stale',
  },
  { name: 'Typing empty', element: <TypingTileView result={EMPTY} now={NOW} />, state: 'empty' },
  {
    name: 'Typing error',
    element: <TypingTileView result={ERROR} />,
    state: 'error',
    isError: true,
  },
  {
    name: 'GitHub ok',
    element: <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    state: 'ready',
  },
  {
    name: 'GitHub stale',
    element: (
      <GitHubTileView result={ok(ACTIVITY, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
    state: 'stale',
  },
  // Without a commit the tile has no commit lines: not the size its skeleton holds.
  {
    name: 'GitHub ok without a commit',
    element: (
      <GitHubTileView
        result={ok({ ...ACTIVITY, latestCommit: null }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
    state: 'empty',
  },
  { name: 'GitHub empty', element: <GitHubTileView result={EMPTY} now={NOW} />, state: 'empty' },
  {
    name: 'GitHub error',
    element: <GitHubTileView result={ERROR} now={NOW} />,
    state: 'error',
    isError: true,
  },
  {
    name: 'Project ok',
    element: <ProjectTileView result={ok(featuredPick(FEATURED))} />,
    state: 'ready',
  },
  {
    name: 'Project without a cover',
    element: <ProjectTileView result={ok(featuredPick({ ...FEATURED, image: null }))} />,
    state: 'ready',
  },
  {
    name: 'Project stale',
    element: (
      <ProjectTileView
        result={ok(featuredPick(FEATURED), { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
    state: 'stale',
  },
  {
    name: 'Project active',
    element: <ProjectTileView result={ok(activePick(FEATURED))} now={NOW} />,
    state: 'ready',
  },
  {
    name: 'Project active, stale',
    element: (
      <ProjectTileView
        result={ok(activePick(FEATURED), { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
    state: 'stale',
  },
  { name: 'Project empty', element: <ProjectTileView result={EMPTY} />, state: 'empty' },
  {
    name: 'Project error',
    element: <ProjectTileView result={ERROR} />,
    state: 'error',
    isError: true,
  },
  {
    name: 'Place ok',
    element: <PlaceTileView result={ok(PAST_PLACE)} now={NOW} />,
    state: 'ready',
  },
  {
    name: 'Place stale',
    element: (
      <PlaceTileView result={ok(PAST_PLACE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />
    ),
    state: 'stale',
  },
  { name: 'Place empty', element: <PlaceTileView result={EMPTY} now={NOW} />, state: 'empty' },
  {
    name: 'Place error',
    element: <PlaceTileView result={ERROR} now={NOW} />,
    state: 'error',
    isError: true,
  },
  {
    name: 'Roles ok',
    element: <RolesTileView result={ok({ roles: roles(3), total: 5 })} />,
    state: 'ready',
  },
  {
    name: 'Roles stale',
    element: (
      <RolesTileView
        result={ok({ roles: roles(3), total: 5 }, { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />
    ),
    state: 'stale',
  },
  {
    name: 'Roles with only the hero’s role',
    element: <RolesTileView result={ok({ roles: roles(1), total: 1 })} />,
    state: 'empty',
  },
  { name: 'Roles empty', element: <RolesTileView result={EMPTY} />, state: 'empty' },
  {
    name: 'Roles error',
    element: <RolesTileView result={ERROR} />,
    state: 'error',
    isError: true,
  },
  { name: 'Index ok', element: <SiteIndexTileView counts={COUNTS} />, state: 'ready' },
  // A count it could not load leaves its cell a line shorter: not the reference content.
  {
    name: 'Index with one failed count',
    element: <SiteIndexTileView counts={{ ...COUNTS, roles: null }} />,
    state: 'error',
  },
  {
    name: 'Index with failed counts',
    element: <SiteIndexTileView counts={UNKNOWN_SITE_COUNTS} />,
    state: 'error',
    isError: true,
  },
];

/** Every skeleton, which the contract marks loading and busy. */
const SKELETON_CASES = [
  ['LeetCode', <LeetCodeTileSkeleton key="leetcode" />],
  ['Typing', <TypingTileSkeleton key="typing" />],
  ['GitHub', <GitHubTileSkeleton key="github" />],
  ['Featured project', <ProjectTileSkeleton key="project" />],
  ['Recently at', <PlaceTileSkeleton key="place" />],
  ['Current roles', <RolesTileSkeleton key="roles" />],
  ['Site index', <SiteIndexTileSkeleton key="index" />],
] as const;

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

  // One stretched link, so one focus ring: a linked tile rings itself for its TileLink only.
  it.each(VIEW_CASES)('$name has at most one stretched link', ({ element }) => {
    const { container } = render(element);
    const stretched = container.querySelectorAll('[data-tile-link]');
    expect(stretched.length).toBeLessThanOrEqual(1);
    if (stretched.length === 1) expect(tileOf(container)).toHaveAttribute('data-linked-tile');
  });

  // The owner: "some of the cards don't wrap around its contents".
  it.each(VIEW_CASES)('$name hugs its content', ({ element }) => {
    const { container } = render(element);
    expectHugs(tileOf(container));
  });

  // Refined type: sentence case, and mono only for a machine token (the repository).
  it.each(VIEW_CASES)('$name sets no upper case and no mono caption', ({ element }) => {
    const { container } = render(element);
    expect(
      container.querySelector('.label-mono, .uppercase, .font-mono, .text-meta, .text-label'),
    ).toBeNull();
    for (const label of container.querySelectorAll('h2')) {
      expect(label.className).toMatch(/\btile-label\b|\bsr-only\b/);
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

// The browser checks compare only tiles showing their reference content with the server's
// estimates, so every other state must say so on the tile's root (tile-states.tsx).
describe('the tile state contract', () => {
  it.each(VIEW_CASES)('$name says data-state="$state" on its root', ({ element, state }) => {
    const { container } = render(element);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', state);
    expect(tile).not.toHaveAttribute('aria-busy');
  });

  it.each(VIEW_CASES)(
    '$name marks a line that says when stale data was read',
    ({ element, state }) => {
      const { container } = render(element);
      const staleLines = [...container.querySelectorAll('[data-stale]')];
      if (state !== 'stale') {
        expect(staleLines).toHaveLength(0);
        return;
      }
      expect(staleLines).toHaveLength(1);
      expect(staleLines[0]).toHaveAttribute('data-stale', '');
      expect(staleLines[0]?.textContent).toMatch(/as of Nov 5/);
    },
  );

  it.each(SKELETON_CASES)('the %s skeleton is loading and busy', (_label, element) => {
    const { container } = render(element);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'loading');
    expect(tile).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[data-stale]')).toBeNull();
  });

  it('gives each server tile’s error fallback (TILE_ERROR) the error state', () => {
    for (const element of [
      <LeetCodeTileView key="leet" result={ERROR} />,
      <TypingTileView key="type" result={ERROR} />,
      <GitHubTileView key="gh" result={ERROR} />,
      <ProjectTileView key="proj" result={ERROR} />,
      <PlaceTileView key="place" result={ERROR} />,
      <RolesTileView key="role" result={ERROR} />,
      <SiteIndexTileView key="strip" counts={UNKNOWN_SITE_COUNTS} />,
    ]) {
      const { container } = render(element);
      expect(tileOf(container)).toHaveAttribute('data-state', 'error');
      cleanup();
    }
  });
});

describe('LeetCodeTileView', () => {
  it('makes its label the one stretched link to the profile, over the solved split', () => {
    const { container } = render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');

    const label = screen.getByRole('heading', { level: 2 });
    expect(label).toHaveClass('tile-label', 'text-muted-foreground');
    const link = within(label).getByRole('link', { name: `LeetCode profile ${NEW_TAB}` });
    expect(link).toHaveAttribute('href', 'https://leetcode.com/u/WomB0ComB0/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('data-tile-link');
    expect(within(tile).getAllByRole('link')).toEqual([link]);

    expect(within(tile).getByText('215')).toHaveClass('figure-md', 'text-foreground');
    expect(within(tile).getByText('solved')).toHaveClass('figure-unit', 'text-muted-foreground');
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
  });

  // 'refreshed every 6 h' was a cache setting, not a fact about the number: cut.
  it('ends at its legend: no context line under it', () => {
    const { container } = render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const tile = tileOf(container);
    expect(within(tile).queryByText(/refreshed/)).toBeNull();
    expect(shownChildren(tile).at(-1)).toHaveAttribute('data-segment-bar');
  });

  // The chart series tones painted Easy periwinkle, Medium orange and Hard green.
  it('paints each difficulty, and its legend swatch, in LeetCode’s own colour', () => {
    const { container } = render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const parts = [...container.querySelectorAll<HTMLElement>('[data-segment-track] > span')];
    const swatches = [...container.querySelectorAll('dt > span')];
    const leetClasses = ['bg-leet-easy', 'bg-leet-medium', 'bg-leet-hard'];

    expect(parts.map((part) => part.dataset.segment)).toEqual(['easy', 'medium', 'hard']);
    expect(parts.map((part) => part.className)).toEqual(leetClasses);
    expect(swatches).toHaveLength(3);
    for (const [index, swatch] of swatches.entries()) {
      expect(swatch).toHaveClass(leetClasses[index] as string);
      expect(swatch.className).not.toMatch(/bg-chart-/);
    }
  });

  it('shows sighted readers that the label opens a new tab, as every external link does', () => {
    render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />);
    const link = screen.getByRole('link', { name: `LeetCode profile ${NEW_TAB}` });
    expect(link.querySelector('[data-new-tab-arrow]')).toHaveAttribute('aria-hidden', 'true');
    // Centred on the 13px label, the 14px arrow does not grow its line past the skeleton's.
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('[&_svg]:align-middle');
  });

  it('says when stale numbers were read, beside a clock', () => {
    const { container } = render(
      <LeetCodeTileView result={ok(LEETCODE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    const note = within(tile).getByText('as of Nov 5 11:02 AM ET');
    expect(note).toHaveClass('tile-meta');
    expect(note).toHaveAttribute('data-dated');
    expect(note.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows words in the figure’s place when there is nothing solved to show', () => {
    render(<LeetCodeTileView result={EMPTY} now={NOW} />);
    expect(screen.getByText('No solved problems yet')).toHaveClass(
      'tile-title',
      'text-muted-foreground',
    );
  });

  it('is a plain tile with the error and an ordinary link to the profile', () => {
    const { container } = render(<LeetCodeTileView result={ERROR} />);
    const tile = tileOf(container);
    expect(tile).not.toHaveAttribute('data-linked-tile');
    expect(screen.getByRole('heading', { level: 2, name: 'LeetCode' })).toBeInTheDocument();
    expect(within(tile).getByText('LeetCode stats unavailable')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: `LeetCode profile ${NEW_TAB}` })).toHaveAttribute(
      'href',
      'https://leetcode.com/u/WomB0ComB0/',
    );
  });
});

describe('TypingTileView', () => {
  it('shows the 60 s best and its accuracy, its label linking the profile', () => {
    const { container } = render(<TypingTileView result={ok(TYPING)} now={NOW} />);
    const tile = tileOf(container);
    const label = screen.getByRole('heading', { level: 2 });
    const link = within(label).getByRole('link', {
      name: `Typing profile on Monkeytype ${NEW_TAB}`,
    });
    expect(link).toHaveAttribute('href', 'https://monkeytype.com/profile/WomB0ComB0');
    expect(link.querySelector('[data-new-tab-arrow]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(tile).getByText('142')).toHaveClass('figure-md');
    expect(within(tile).getByText('wpm')).toHaveClass('figure-unit');
    // Was '60 s personal best · 98.2% acc'.
    const meta = within(tile).getByText('60 s best · 98% accuracy');
    expect(meta).toHaveClass('tile-meta', 'text-muted-foreground');
    // No-break spaces keep '60 s' and '98% accuracy' on one line each, and the dot with the words
    // before it: a narrow tile wraps after the dot, never before 'accuracy'.
    expect(meta.textContent).toBe(`60 s best${META_SEPARATOR}98% accuracy`);
  });

  it('rounds the accuracy to the whole percent, and leaves out one it cannot read', () => {
    expect(typingMeta(92.6)).toBe(`60 s best${META_SEPARATOR}93% accuracy`);
    expect(typingMeta(Number.NaN)).toBe('60 s best');
  });

  it('marks a stale best with when it was read', () => {
    const { container } = render(
      <TypingTileView result={ok(TYPING, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(within(tile).getByText('60 s best · as of Nov 5 11:02 AM ET')).toHaveAttribute(
      'data-dated',
    );
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
  const COMMIT_NAME = `Latest commit: feat(home): the Live Console bento (#604), on GitHub ${NEW_TAB}`;

  it('shows the total in 12 weeks, then the repository, the age and the headline as the link', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');
    // Was 'GITHUB · 12 WEEKS': the period moved onto the unit.
    expect(screen.getByRole('heading', { level: 2, name: 'GitHub' })).toBeInTheDocument();
    expect(within(tile).getByText('412')).toHaveClass('figure-lg', 'text-foreground');
    expect(within(tile).getByText('contributions in 12 weeks')).toHaveClass('figure-unit');

    const repo = within(tile).getByText('portfolio');
    expect(repo).toHaveClass('mono-token');
    expect(repo.parentElement).toHaveTextContent(/^portfolio · 3 h ago$/);
    expect(repo.parentElement).toHaveAttribute('data-dated');

    const commit = within(tile).getByRole('link', { name: COMMIT_NAME });
    expect(commit).toHaveAttribute('href', ACTIVITY.latestCommit?.url);
    expect(commit).toHaveAttribute('data-tile-link');
  });

  // The SHA means nothing to a visitor; 'updated just now' repeated what the commit age says.
  it('shows no SHA, and nothing of its own freshness while fresh', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile.textContent).not.toContain('a1b2c3d');
    expect(within(tile).queryByText(/updated/)).toBeNull();
    expect(tile.querySelector('time')).toBeNull();
  });

  it('shows the headline as a visitor reads it, and names the link with it as written', () => {
    render(<GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />);
    const commit = screen.getByRole('link', { name: COMMIT_NAME });
    const shown = within(commit).getByText('The Live Console bento');
    expect(shown).toHaveAttribute('aria-hidden', 'true');
    // Seen: the headline, then the arrow (glued to it by an invisible word joiner).
    expect(textWithout(commit, '.sr-only, [data-new-tab-arrow]')).toBe('The Live Console bento');
  });

  // A two-line headline used to be clamped together with the arrow after it, hiding the tile's
  // only visible new-tab cue.
  it('cuts only the headline short, so its new-tab arrow is never cut off', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    const commit = within(tile).getByRole('link', { name: COMMIT_NAME });
    const headline = within(commit).getByText('The Live Console bento');
    const arrow = commit.querySelector('[data-new-tab-arrow]');

    expect(headline).toHaveClass('truncate', 'min-w-0');
    expect(arrow).not.toBeNull();
    expect(headline.contains(arrow)).toBe(false);
    // The headline and the arrow are items of one row; nothing around them cuts.
    expect(commit).toHaveClass('flex', 'items-baseline');
    for (let node: HTMLElement | null = commit; node && node !== tile; node = node.parentElement) {
      expect(node.className, node.outerHTML).not.toMatch(/line-clamp|truncate/);
    }
  });

  // At 768 px the cut headline's ellipsis stood 10 to 12 px before the arrow: the arrow's 2 px
  // margin, the 4 px inset of the arrow inside its icon, and what the ellipsis leaves of the
  // headline's box. The arrow is pulled in 4 px, so it sits right after the ellipsis; a 4 px
  // spacer that only a whole headline leaves room for keeps that one's spacing as it was.
  it('sets the new-tab arrow right after a cut headline’s ellipsis, and a whole one as before', () => {
    render(<GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />);
    const commit = screen.getByRole('link', { name: COMMIT_NAME });
    const arrow = commit.querySelector(':scope > [data-new-tab-arrow]');
    expect(arrow?.querySelector('svg')).not.toBeNull();
    expect(commit).toHaveClass(
      // The arrow, pulled 4 px into the headline's box, after the spacer.
      '[&>[data-new-tab-arrow]]:order-2',
      '[&>[data-new-tab-arrow]>svg]:-ml-1',
      // The spacer: 4 px wide, and the first thing to give way when the headline is cut.
      'before:order-1',
      'before:basis-1',
      'before:shrink-[100000]',
    );
    // The headline keeps its place before both, and is the one that is cut.
    const headline = within(commit).getByText('The Live Console bento');
    expect(headline.className).not.toMatch(/order-/);
    expect(headline).toHaveClass('min-w-0', 'truncate');
  });

  // Review finding WF-3: from 29rem the tile went side by side inside the 30rem tier, whose
  // estimate is the stacked tile's (a 64 px hole at 464-479 px bentos).
  it('sets the sparkline beside the figure from a 34rem tile, and in a narrow bento from 30rem', () => {
    const { container } = render(
      <GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const sparkline = container.querySelector('[data-sparkline]');
    const body = sparkline?.parentElement?.parentElement;
    expect(body).toHaveClass(
      'grid',
      '@[34rem]:grid-cols-[minmax(min-content,2fr)_minmax(0,3fr)]',
      '@min-[30rem]/bento:@max-[40rem]/bento:grid-cols-[minmax(min-content,2fr)_minmax(0,3fr)]',
    );
    expect(sparkline).toHaveAttribute('height', '56');
    expect(sparkline).toHaveClass('@[34rem]:h-18', '@min-[30rem]/bento:@max-[40rem]/bento:h-18');
    expect(container.innerHTML).not.toContain('29rem');
  });

  // Review finding WF2-LAYOUT-1: in a 586 to 640 px bento the tile is 34rem wide, and the built CSS
  // puts the 34rem rule's `minmax(0,2fr)` after the narrow bento's `minmax(min-content,2fr)`, so
  // it won: the nowrap figure row ran 45 to 80 px into the sparkline's column, and the skeleton's
  // bar painted over '12 weeks'. Both rules can match at once, and Tailwind orders them, not this
  // class list, so every rule that sets the columns gives the text column the same min-content.
  it('gives the figure’s column its min-content in every rule that sets the columns, loaded and loading', () => {
    const bodyOf = (container: HTMLElement): Element | null | undefined =>
      container.querySelector('.figure-row')?.parentElement?.parentElement;
    const loaded = bodyOf(render(<GitHubTileView result={ok(ACTIVITY)} now={NOW} />).container);
    const skeleton = bodyOf(render(<GitHubTileSkeleton />).container);

    for (const body of [loaded, skeleton]) {
      const columnRules = (body?.className ?? '')
        .split(/\s+/)
        .filter((name) => /(?:^|:)grid-cols-/.test(name));
      expect(columnRules).toHaveLength(2);
      for (const rule of columnRules) {
        expect(rule).toMatch(/:grid-cols-\[minmax\(min-content,2fr\)_minmax\(0,3fr\)\]$/);
      }
    }
    expect(skeleton?.className).toBe(loaded?.className);
  });

  // Sized by the nowrap headline, the loaded text column took 376 px in a 600 px window while the
  // skeleton's took 197 px and wrapped the unit: the skeleton stood 24 px taller.
  it('sizes its text column by the figure’s row, never the commit headline, as its skeleton does', () => {
    const IN_NARROW_BENTO = '@min-[30rem]/bento:@max-[40rem]/bento:';
    const loaded = render(<GitHubTileView result={ok(ACTIVITY)} now={NOW} />).container;
    const column = loaded.querySelector('.figure-row')?.parentElement;
    // figure-row is a wrapping flex row: both are needed to keep the unit beside the figure.
    expect(column).toHaveClass(
      `${IN_NARROW_BENTO}[&>.figure-row]:flex-nowrap`,
      `${IN_NARROW_BENTO}[&>.figure-row]:whitespace-nowrap`,
    );
    const commitLines = column?.querySelector('[data-dated]')?.parentElement;
    expect(commitLines).toHaveClass('contain-inline-size');
    cleanup();

    const skeleton = render(<GitHubTileSkeleton />).container;
    const skeletonColumn = skeleton.querySelector('.figure-row')?.parentElement;
    expect(skeletonColumn?.className).toBe(column?.className);
    expect(skeletonColumn?.lastElementChild?.className).toBe(commitLines?.className);
  });

  // Review finding CR611-11: GitHub's wide lane (a 1fr lane, its text column at most 292.55 px) is
  // about 1 px narrower than a four-digit row with Linux's hinted advances and about 3 px wider
  // unhinted (macOS, Windows), so the tile's height, and roles' lane, hung on the platform and the
  // digit count.
  it('puts the unit on its own line in a wide bento, loaded and loading', () => {
    const UNIT_OWN_LINE = '@min-[67.5rem]/bento:[&>.figure-row>:last-child]:basis-full';
    const loaded = render(<GitHubTileView result={ok(ACTIVITY)} now={NOW} />).container;
    expect(loaded.querySelector('.figure-row')?.parentElement).toHaveClass(UNIT_OWN_LINE);
    cleanup();

    const skeleton = render(<GitHubTileSkeleton />).container;
    expect(skeleton.querySelector('.figure-row')?.parentElement).toHaveClass(UNIT_OWN_LINE);
  });

  // CodeRabbit finding #11: below 1,000 contributions the row fit where '1,311 contributions in
  // 12 weeks' wraps, in a 292 to 327 px phone bento and a 640 to 688 px one, so the tile stood
  // 24 px under its skeleton. Now the unit's line hangs on the tile's width alone: its own line in
  // a tile whose content box is narrower than the widest four-digit row, and beside the figure from
  // there, where any total up to four digits fits. Hinted (Linux) the digits differ: '7,777' is
  // the widest row (297.61 px; '0,000' and '1,311' 293.61, '2,222' 289.61), so 18.36rem, just
  // over '0,000', left '1,777' and '7,777' wrapping where '1,311' did not (review finding F1).
  // Unhinted every four-digit row is 289.69 px.
  it('puts the unit on its own line in a tile narrower than a four-digit row, loaded and loading', () => {
    const NARROW_TILE = '@max-[18.61rem]:[&>.figure-row>:last-child]:basis-full';
    for (const total of [8, 412, 1311, 1777, 7777]) {
      const loaded = render(<GitHubTileView result={ok({ ...ACTIVITY, total })} now={NOW} />);
      expect(loaded.container.querySelector('.figure-row')?.parentElement).toHaveClass(NARROW_TILE);
      cleanup();
    }
    const skeleton = render(<GitHubTileSkeleton />).container;
    expect(skeleton.querySelector('.figure-row')?.parentElement).toHaveClass(NARROW_TILE);
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

  it('links the profile from the label instead of a commit that has no URL', () => {
    const latestCommit = { ...ACTIVITY.latestCommit, url: ' ' } as GitHubActivity['latestCommit'];
    render(
      <GitHubTileView
        result={ok({ ...ACTIVITY, latestCommit }, { asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(
      within(heading).getByRole('link', { name: `GitHub profile ${NEW_TAB}` }),
    ).toHaveAttribute('href', 'https://github.com/WomB0ComB0');
    expect(screen.queryByText(/Live Console bento/)).toBeNull();
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

  it('shows stale activity as of an absolute New York time, beside a clock', () => {
    render(<GitHubTileView result={ok(ACTIVITY, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />);
    const note = screen.getByText('as of Nov 5 11:02 AM ET');
    expect(note).toHaveClass('tile-meta');
    expect(note.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
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
    expect(screen.queryByText('portfolio')).toBeNull();
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
  /** The label's detail beside the h2: '2025', 'committed yesterday'. */
  const detailOf = (tile: HTMLElement): HTMLElement | null =>
    (tile.querySelector('h2')?.nextElementSibling as HTMLElement | null) ?? null;

  it('shows the 2:1 cover, the label with the year, the title link and one description line', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');

    // Decorative: the title beside it names the project.
    const cover = tile.querySelector('img');
    expect(cover).toHaveAttribute('alt', '');
    expect(cover).toHaveAttribute('loading', 'lazy');
    expect(cover).toHaveAttribute('sizes', PROJECT_COVER_SIZES);
    // self-start: as the media object's left half it keeps 2:1 instead of stretching to the text.
    expect(cover).toHaveClass('aspect-[2/1]', 'w-full', 'object-cover', 'self-start');

    expect(within(tile).getByRole('heading', { level: 2 })).toHaveTextContent(/^Featured project$/);
    expect(seenText(detailOf(tile) as HTMLElement)).toBe('· 2025');
    const title = within(tile).getByRole('heading', { level: 3 });
    expect(title).toHaveClass('tile-title-lg', 'line-clamp-1');
    expect(title.className).not.toContain('line-clamp-2');
    expect(within(title).getByRole('link', { name: 'Fraud Guard' })).toHaveAttribute(
      'href',
      `/projects/${encodeURIComponent(FEATURED._id)}`,
    );
    expect(within(tile).getByText('AI-Powered Transaction Monitoring')).toHaveClass(
      'tile-sub',
      'text-muted-foreground',
    );
  });

  // The 2-line description, the chips (which contradicted it) and 'Category · Status' are cut.
  it('leaves the description, the tech chips, the category and the status to the project page', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} />);
    const tile = tileOf(container);
    expect(tile.textContent).not.toContain(FEATURED.description);
    expect(within(tile).queryByRole('list')).toBeNull();
    for (const word of ['Python', 'Machine Learning', 'Completed']) {
      expect(tile.textContent).not.toContain(word);
    }
  });

  /** The tile's one description line, under the title. */
  const subtitleOf = (tile: HTMLElement): HTMLElement | null =>
    tile.querySelector<HTMLElement>('h3 + p.tile-sub');

  // CodeRabbit finding #7: a project with no separator in its title (11 of the 22) had no
  // description line, so it stood 26 px under its skeleton when stacked. Every project now has
  // exactly one: its own short description, from Sanity for the featured pick and the latest
  // work alike (both are Sanity projects; GitHub's commits say only which one).
  it.each([
    ['the featured pick', featuredPick],
    ['the latest work', (project: Project) => activePick(project)],
  ])(
    'fills the description line of %s from its own description when the title has no separator',
    (_name, pick) => {
      const grepo = {
        ...FEATURED,
        title: 'grepo',
        description:
          'Open-source tool that writes READMEs with AI. It also writes repo descriptions.',
      };
      const { container } = render(<ProjectTileView result={ok(pick(grepo))} now={NOW} />);
      const tile = tileOf(container);
      expect(within(tile).getByRole('link', { name: 'grepo' })).toBeInTheDocument();
      expect(subtitleOf(tile)).toHaveTextContent(
        /^Open-source tool that writes READMEs with AI\.$/,
      );
      expect(subtitleOf(tile)).toHaveClass('tile-sub', 'text-muted-foreground', 'line-clamp-1');
      expect(tile.textContent).not.toContain('It also writes');
    },
  );

  it.each([
    ['a blank description: the category', { description: '  ' }, 'Machine Learning'],
    [
      'a blank description and category: a fixed line',
      { description: '', category: ' ' },
      PROJECT_SUBTITLE_FALLBACK,
    ],
  ])('never leaves the description line empty, with %s', (_case, fields, line) => {
    const { container } = render(
      <ProjectTileView result={ok(featuredPick({ ...FEATURED, title: 'grepo', ...fields }))} />,
    );
    expect(subtitleOf(tileOf(container))).toHaveTextContent(new RegExp(`^${line}$`));
    expect(PROJECT_SUBTITLE_FALLBACK.trim()).not.toBe('');
  });

  it('takes the split title’s description first, as written', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} />);
    expect(subtitleOf(tileOf(container))).toHaveTextContent(/^AI-Powered Transaction Monitoring$/);
  });

  /** The cover file's URL, from its next/image source. */
  const coverSource = (image: Project['image']): string => {
    const { container } = render(
      <ProjectTileView result={ok(featuredPick({ ...FEATURED, image }))} />,
    );
    const source = imageSource(container.querySelector('img') as HTMLElement);
    cleanup();
    return source;
  };

  // Review finding WF-PERF-3: in Studio's own crop, a 16:10 cover shipped 25% more pixels than
  // the 2:1 box shows, and a portrait one far more.
  it('asks Sanity for a 2:1 file at the cover’s width, cut within Studio’s crop', () => {
    const cropped = { ...COVER, crop: { top: 0, bottom: 0.5, left: 0.1, right: 0.1 } };
    const source = coverSource(cropped);
    expect(source).toContain('cdn.sanity.io/images/test/test/cover1-1600x1000.png?');
    // The crop keeps 1280 x 500 of the 1600 x 1000 file: 2:1 takes 1000 x 500 of it, centred.
    for (const param of ['w=1200', 'h=600', 'fit=crop', 'auto=format', 'rect=300,0,1000,500']) {
      expect(source).toContain(param);
    }
  });

  // @sanity/image-url's fit() centres the 2:1 window on the hotspot whenever both a width and a
  // height are asked for, so the subject stays in the file, and the file is the box.
  it('cuts the 2:1 file around the Sanity hotspot, and centres a cover without one', () => {
    // The hotspot is low in the frame: the 1600 x 800 window drops to the file's foot.
    expect(coverSource(COVER_WITH_HOTSPOT)).toContain('rect=0,200,1600,800');
    expect(coverSource(COVER)).toContain('rect=0,100,1600,800');
  });

  // The file is already the box's 2:1, so an object-position has nothing left to move.
  it('sets no object-position: the file is cut to the box', () => {
    const { container } = render(
      <ProjectTileView result={ok(featuredPick({ ...FEATURED, image: COVER_WITH_HOTSPOT }))} />,
    );
    expect(container.querySelector('img')?.style.objectPosition).toBe('');
  });

  /** The two conditions of the media object: a 38rem tile, or a 30rem to 40rem bento. */
  const IN_MEDIA = ['@[38rem]:', '@min-[30rem]/bento:@max-[40rem]/bento:'] as const;
  const inMedia = (utility: string): string[] => IN_MEDIA.map((variant) => `${variant}${utility}`);

  // D2: phones (a bento below 30rem) get the stacked 2:1 cover of the brief; the 30rem tier,
  // where the estimates change too, keeps the media object, so the hero stays the largest tile.
  it('becomes a media object from a 38rem tile, and in a narrow bento from 30rem', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} />);
    const cover = container.querySelector('img');
    expect(cover?.parentElement).toHaveClass('flex-col', ...inMedia('flex-row'));
    expect(cover).toHaveClass(...inMedia('w-1/2'));
    expect(container.innerHTML).not.toContain('22rem');
  });

  // Review finding project-skeleton-parity-cover-left: in the media object the description took
  // two lines and the label row wrapped, so the loaded tile stood 20 to 44 px over its skeleton.
  // CodeRabbit findings #4 and #7: stacked, a two-line title or description made it 20 to 26 px
  // taller than its skeleton, so the title and the description are one line each everywhere.
  it('keeps the title and the description to one line each, stacked and in the media object', () => {
    const { container } = render(<ProjectTileView result={ok(activePick(FEATURED))} now={NOW} />);
    const tile = tileOf(container);
    for (const line of [
      within(tile).getByRole('heading', { level: 3 }),
      within(tile).getByText('AI-Powered Transaction Monitoring'),
    ]) {
      expect(line).toHaveClass('line-clamp-1', 'wrap-break-word');
      expect(line.className).not.toMatch(/line-clamp-(?!1\b)/);
    }
    // The label row is one line at every width: its detail is cut short, never wrapped.
    expect(tile.querySelector('h2')?.parentElement).toHaveClass('truncate');
  });

  // Review finding F5: a cut title shows whole on hover, as the place's name does.
  it('puts the whole title in the heading’s title attribute', () => {
    const { container } = render(<ProjectTileView result={ok(activePick(FEATURED))} now={NOW} />);
    expect(within(tileOf(container)).getByRole('heading', { level: 3 })).toHaveAttribute(
      'title',
      'Fraud Guard',
    );
  });

  it('draws a 2:1 typographic cover of the initials without an image, never "No Image Available"', () => {
    const { container } = render(
      <ProjectTileView result={ok(featuredPick({ ...FEATURED, image: null }))} />,
    );
    const cover = container.querySelector('[data-cover="typographic"]');
    expect(cover).toHaveAttribute('aria-hidden', 'true');
    expect(cover).toHaveClass('aspect-[2/1]');
    expect(cover).toHaveTextContent(/^FG$/);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toMatch(/no image/i);
  });

  it('falls back to the typographic cover when the image reference is malformed', () => {
    const broken = { ...COVER, asset: { _ref: 'not-an-image-ref', _type: 'reference' as const } };
    const { container } = render(
      <ProjectTileView result={ok(featuredPick({ ...FEATURED, image: broken }))} />,
    );
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
    render(<ProjectTileView result={ok(featuredPick({ ...FEATURED, _id: 'fraud/guard v2' }))} />);
    expect(screen.getByRole('link', { name: 'Fraud Guard' })).toHaveAttribute(
      'href',
      '/projects/fraud%2Fguard%20v2',
    );
  });

  // Review findings WF2-D2-stale-asof-cut and WF2-reg-1: the label row is one line cut with an
  // ellipsis, and 'as of Nov 5' ended its detail, so a 199 to 286 px row (a 480 to 672 px bento,
  // or a 320 px phone) cut the tile's only visible sign that it is stale. It is a line of its own.
  it.each([
    ['the featured pick', featuredPick(FEATURED), '· 2025'],
    ['the latest work', activePick(FEATURED), '· committed yesterday'],
  ])(
    'keeps the day a stale list is from in sight for %s: a line of its own, outside the label row its ellipsis cuts',
    (_name, pick, detail) => {
      const { container } = render(
        <ProjectTileView result={ok(pick, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
      );
      const tile = tileOf(container);
      const row = tile.querySelector('h2')?.parentElement;
      expect(tile).toHaveAttribute('data-state', 'stale');
      expect(seenText(detailOf(tile) as HTMLElement)).toBe(detail);
      expect(detailOf(tile)).not.toHaveAttribute('data-stale');

      const staleLine = within(tile).getByText('as of Nov 5');
      expect(staleLine).toHaveAttribute('data-stale', '');
      expect(staleLine).toHaveAttribute('data-dated');
      expect(row?.contains(staleLine)).toBe(false);
      for (
        let node: HTMLElement | null = staleLine;
        node && node !== tile;
        node = node.parentElement
      ) {
        expect(node.className).not.toMatch(/\b(?:truncate|line-clamp-\d|whitespace-nowrap)\b/);
      }
    },
  );

  it('says nothing of a stale list when the list is fresh', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} now={NOW} />);
    expect(screen.queryByText(/as of/)).toBeNull();
    expect(container.querySelector('[data-stale]')).toBeNull();
  });

  // Review finding project-label-row-leading-dot: as two items of a wrapping flex row, the label
  // and its detail broke onto two lines, the second starting with '·'. Now they are one line box
  // (an inline h2, then the detail), on the label's 16 px line (globals.css's p line height of
  // 1.75 once made the detail 22.75 px tall), cut with an ellipsis instead of wrapping.
  it('sets the label and its detail in one line box that never wraps, the dot glued to the label', () => {
    const { container } = render(<ProjectTileView result={ok(activePick(FEATURED))} now={NOW} />);
    const label = within(tileOf(container)).getByRole('heading', { level: 2 });
    const detail = detailOf(tileOf(container));
    const row = label.parentElement;

    expect(row).toHaveClass('tile-label', 'truncate');
    expect(row?.tagName).toBe('DIV');
    // globals.css gives every h2 `text-wrap: balance`, which sets text-wrap-mode back to wrap: the
    // h2 needs its own nowrap, or 'Latest work' breaks in two inside the truncated row.
    expect(label).toHaveClass('inline', 'whitespace-nowrap');
    expect(detail?.tagName).toBe('SPAN');
    expect(detail?.parentElement).toBe(row);
    // META_SEPARATOR starts with a no-break space, so the dot never starts a line.
    const separator = detail?.firstElementChild;
    expect(separator).toHaveAttribute('aria-hidden', 'true');
    expect(separator?.textContent).toBe(META_SEPARATOR);
    expect(META_SEPARATOR.startsWith(' ')).toBe(true);
  });

  it('labels the project his commits chose "Latest work" beside the day he last committed', () => {
    const { container } = render(<ProjectTileView result={ok(activePick(FEATURED))} now={NOW} />);
    const tile = tileOf(container);

    // A label that claims only what GitHub shows, so the project's status is no contradiction.
    const label = within(tile).getByRole('heading', { level: 2 });
    expect(label).toHaveTextContent(/^Latest work$/);
    expect(seenText(detailOf(tile) as HTMLElement)).toBe('· committed yesterday');
    expect(detailOf(tile)).toHaveAttribute('data-dated');
    // The label's own words never depend on the date.
    expect(label).not.toHaveAttribute('data-dated');
    expect(tile.textContent).not.toContain('2025');
    expect(within(tile).getByRole('link', { name: 'Fraud Guard' })).toHaveAttribute(
      'href',
      `/projects/${encodeURIComponent(FEATURED._id)}`,
    );
  });

  it.each([
    ['2026-11-05', 'committed today'],
    ['2026-11-02', 'committed 3 d ago'],
    ['2026-10-20', 'committed Oct 20'],
  ])('words a last commit on %s as "%s": a day, never a time', (lastCommitDay, words) => {
    const { container } = render(
      <ProjectTileView result={ok(activePick(FEATURED, lastCommitDay))} now={NOW} />,
    );
    expect(seenText(detailOf(tileOf(container)) as HTMLElement)).toBe(`· ${words}`);
  });

  it('keeps "Featured project" beside the year, and says nothing of a commit, for the featured pick', () => {
    const { container } = render(<ProjectTileView result={ok(featuredPick(FEATURED))} now={NOW} />);
    const tile = tileOf(container);

    expect(within(tile).getByRole('heading', { level: 2 })).toHaveTextContent(/^Featured project$/);
    expect(within(tile).queryByText(/committed|pushed/)).toBeNull();
    expect(detailOf(tile)).not.toHaveAttribute('data-dated');
  });

  it('leaves out a commit day it cannot word, keeping the label', () => {
    const { container } = render(
      <ProjectTileView result={ok(activePick(FEATURED, '2026-11-06'))} now={NOW} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Latest work' })).toBeInTheDocument();
    expect(detailOf(tileOf(container))).toBeNull();
  });

  it('takes up to two initials from the title', () => {
    expect(initialsOf('Fraud Guard')).toBe('FG');
    expect(initialsOf('grepo')).toBe('G');
    expect(initialsOf('FOIA-Stream data tools')).toBe('FS');
    expect(initialsOf('')).toBe('');
  });
});

describe('PlaceTileView', () => {
  /** The tile's context line: its dated <p>. */
  const metaOf = (container: HTMLElement): HTMLElement => {
    const meta = tileOf(container).querySelector<HTMLElement>('p[data-dated]');
    if (!meta) throw new Error('no context line');
    return meta;
  };

  /** 1:07 PM in New York on Nov 5: past noon, so a visit on Nov 4 is over (placeCutoffDay). */
  const AFTERNOON = Date.parse('2026-11-05T18:07:00Z');

  it('links the place by name under "Recently at" and says what and when', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-linked-tile');
    // Was 'LAST PLACE', which read like a ranking.
    expect(screen.getByRole('heading', { level: 2, name: 'Recently at' })).toHaveClass(
      'tile-label',
    );
    expect(within(tile).getByRole('link', { name: PAST_PLACE.name })).toHaveAttribute(
      'href',
      `/places/${encodeURIComponent(PAST_PLACE._id)}`,
    );
    expect(seenText(metaOf(container))).toBe('Conference · Oct 30');
    expect(metaOf(container)).toHaveClass('tile-meta');
    expect(within(tile).getByRole('heading', { level: 3 })).toHaveClass('tile-title');
  });

  // CodeRabbit finding #6: a name that wrapped (32 of the 57 places have 26 or more characters)
  // made the tile 18 px taller than its skeleton, and the md estimate hedged between the two.
  it('keeps the name to one line, cut with an ellipsis, the whole name in its title and link', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const name = within(tileOf(container)).getByRole('heading', { level: 3 });
    expect(name).toHaveClass('truncate');
    expect(name.className).not.toMatch(/line-clamp/);
    expect(name).toHaveAttribute('title', PAST_PLACE.name);
    expect(within(name).getByRole('link', { name: PAST_PLACE.name })).toBeInTheDocument();
  });

  // Review finding F3: without a photo the text set the row, 4 px under the thumbnail's 64 px, so
  // a place whose photos are not uploaded yet stood shorter than its skeleton and its estimate.
  it('keeps the row the thumbnail’s 64 px with or without a photo, like its skeleton', () => {
    const rowOf = (container: HTMLElement) =>
      within(tileOf(container)).getByRole('heading', { level: 3 }).parentElement?.parentElement;
    const withPhoto = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const withoutPhoto = render(
      <PlaceTileView result={ok({ ...PAST_PLACE, photos: [] })} now={NOW} />,
    );
    expect(withoutPhoto.container.querySelector('img')).toBeNull();
    for (const { container } of [withPhoto, withoutPhoto]) {
      expect(rowOf(container)).toHaveClass('min-h-16', 'items-center');
    }
    const skeleton = render(<PlaceTileSkeleton />);
    expect(skeleton.container.querySelector('.size-16')?.parentElement).toHaveClass('min-h-16');
  });

  // 'Event · Aug 21': the days say when, so no '6 d ago' or 'yesterday' after them.
  it.each([
    ['a single day', PAST_PLACE, NOW, 'Conference · Oct 30'],
    [
      'yesterday’s visit',
      { ...PAST_PLACE, startDate: '2026-11-04' },
      AFTERNOON,
      'Conference · Nov 4',
    ],
    [
      'a run ending yesterday',
      { ...PAST_PLACE, startDate: '2026-10-20', endDate: '2026-11-04' },
      AFTERNOON,
      'Conference · Oct 20 – Nov 4',
    ],
  ])('says the days of %s and never how long ago', (_case, place, now, line) => {
    const { container } = render(<PlaceTileView result={ok(place)} now={now} />);
    expect(seenText(metaOf(container))).toBe(line);
    expect(metaOf(container).textContent).not.toMatch(/ago|yesterday|today/);
  });

  it('says which day a stale place’s list is from', () => {
    const { container } = render(
      <PlaceTileView result={ok(PAST_PLACE, { stale: true, asOf: FIVE_MIN_AGO })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(seenText(metaOf(container))).toBe('Conference · Oct 30 · as of Nov 5');
  });

  it('gives a place from another year its date once, with the year', () => {
    const { container } = render(
      <PlaceTileView result={ok({ ...PAST_PLACE, startDate: '2025-10-30' })} now={NOW} />,
    );
    expect(seenText(metaOf(container))).toBe('Conference · Oct 30, 2025');
  });

  it('encodes the document id in the link', () => {
    render(<PlaceTileView result={ok({ ...PAST_PLACE, _id: 'tech/week 25' })} now={NOW} />);
    expect(screen.getByRole('link', { name: PAST_PLACE.name })).toHaveAttribute(
      'href',
      '/places/tech%2Fweek%2025',
    );
  });

  /** No trace of the place's coordinates (40.7128, -74.006): no degrees, none of their digits. */
  const expectNoCoordinates = (tile: HTMLElement): void => {
    const text = tile.textContent ?? '';
    expect(text).not.toContain('°');
    expect(text).not.toMatch(/40\.7|74\.0/);
  };

  // It showed from an 18rem tile only; the photo now leads the row at every width.
  it('shows the photo as a 64px thumbnail at every width, before the text, and never the coordinates', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const tile = tileOf(container);
    const thumbnail = tile.querySelector('img');
    // Decorative: the name beside it says where.
    expect(thumbnail).toHaveAttribute('alt', '');
    expect(thumbnail).toHaveAttribute('sizes', '64px');
    expect(thumbnail).toHaveClass('size-16', 'rounded-lg', 'object-cover');
    expect(thumbnail?.className).not.toMatch(/hidden/);
    expect(thumbnail?.nextElementSibling).toContainElement(
      screen.getByRole('heading', { level: 2 }),
    );
    const source = imageSource(thumbnail as HTMLElement);
    expect(source).toContain('stage1-800x600.jpg?');
    for (const param of ['w=128', 'h=128', 'fit=crop']) expect(source).toContain(param);
    expectNoCoordinates(tile);
  });

  it('shows nothing in the photo’s place without photos: no coordinates, no map pin', () => {
    const { container } = render(
      <PlaceTileView result={ok({ ...PAST_PLACE, photos: null })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile.querySelector('img')).toBeNull();
    expect(tile.querySelector('svg')).toBeNull();
    expectNoCoordinates(tile);
  });

  it('never says "Here now" or shows an amber dot for a past visit', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    const tile = tileOf(container);
    expect(within(tile).getByRole('heading', { level: 2 })).toHaveAccessibleName('Recently at');
    expect(within(tile).queryByText(/here now/i)).toBeNull();
    expect(tile.querySelector('[data-status-dot], .text-ongoing')).toBeNull();
    expectNoCoordinates(tile);
  });

  // Past visits only (owner decision). selectLatestPlace never hands the tile a place whose visit
  // may be on, and the view holds the same rule, so a place that reaches it another way (another
  // loader, an old selection) shows the empty state: never its name, days or 'today'.
  it.each([
    ['a visit dated today', { startDate: '2026-11-05' }, NOW],
    ['a range that is on', { startDate: '2026-10-30', endDate: '2026-11-08' }, NOW],
    ['a range that ends today', { startDate: '2026-10-30', endDate: '2026-11-05' }, AFTERNOON],
    ['a place yet to come', { startDate: '2026-11-12' }, AFTERNOON],
    ['an undated place', { startDate: null }, AFTERNOON],
    ['a visit dated yesterday, before noon', { startDate: '2026-11-04' }, NOW],
  ])('shows no place for %s', (_case, days, now) => {
    const { container } = render(
      <PlaceTileView result={ok({ ...PAST_PLACE, ...days })} now={now} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'empty');
    expect(within(tile).getByText('No places yet')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: 'All places' })).toHaveAttribute(
      'href',
      '/places',
    );
    expect(within(tile).queryByText(PAST_PLACE.name)).toBeNull();
    expect(tile.textContent).not.toMatch(/today|Conference|Oct 30|Nov \d/);
    expect(within(tile).queryByText(/here now/i)).toBeNull();
    expectNoCoordinates(tile);
  });

  it('shows no place for a stale list’s place whose visit is on', () => {
    const stale = ok(
      { ...PAST_PLACE, startDate: '2026-11-05' },
      { stale: true, asOf: FIVE_MIN_AGO },
    );
    const { container } = render(<PlaceTileView result={stale} now={NOW} />);
    expect(tileOf(container)).toHaveAttribute('data-state', 'empty');
    expect(screen.queryByText(PAST_PLACE.name)).toBeNull();
  });

  // Corgi NYC's visits were Jul 29 and Sep 15: the span says when.
  const CORGI = makePlace({
    ...PAST_PLACE,
    name: 'Corgi NYC',
    category: 'Event',
    startDate: '2026-07-29',
    endDate: '2026-09-15',
  });

  it('shows a run of visits as its span', () => {
    const { container } = render(<PlaceTileView result={ok(CORGI)} now={NOW} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Recently at' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Corgi NYC' })).toBeInTheDocument();
    expect(seenText(metaOf(container))).toBe('Event · Jul 29 – Sep 15');
  });

  // An en dash is not read at a screen reader's default punctuation level: /places' PlaceDateRange
  // hides it and says 'to', so the two pages read a span alike.
  it('reads a range’s dash as "to" to screen readers, as /places does', () => {
    const { container } = render(<PlaceTileView result={ok(CORGI)} now={NOW} />);
    const meta = metaOf(container);

    expect(heardText(meta)).toBe('Event · Jul 29 to Sep 15');
    expect(within(meta).getByText('–')).toHaveAttribute('aria-hidden', 'true');
    expect(within(meta).getByText('to')).toHaveClass('sr-only');
  });

  it('joins the stale list’s day after a range, and a single day with no dash or "to"', () => {
    const stale = ok(CORGI, { stale: true, asOf: FIVE_MIN_AGO });
    const { container } = render(<PlaceTileView result={stale} now={NOW} />);

    expect(seenText(metaOf(container))).toBe('Event · Jul 29 – Sep 15 · as of Nov 5');
    expect(heardText(metaOf(container))).toBe('Event · Jul 29 to Sep 15 · as of Nov 5');
    cleanup();

    const single = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);
    expect(metaOf(single.container).querySelector('[aria-hidden], .sr-only')).toBeNull();
  });

  // The visual spec masks [data-dated] only, so the rest of the place tile, its label included
  // (always 'Recently at'), is still compared.
  it('marks only the line whose words depend on today data-dated, not the label', () => {
    const { container } = render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />);

    expect([...container.querySelectorAll('[data-dated]')].map((node) => seenText(node))).toEqual([
      'Conference · Oct 30',
    ]);
  });

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
  /** Each role link's words as a sighted reader sees them. */
  const roleLines = (): string[] =>
    screen.getAllByRole('listitem').map((item) => seenText(within(item).getByRole('link')));

  // Owner decision: the hero's role line already says 'Founder & CEO, ResQ Systems'.
  it('lists the current roles beside the hero’s, never the hero’s own', () => {
    const shown = roles(3);
    const { container } = render(<RolesTileView result={ok({ roles: shown, total: 5 })} />);
    const tile = tileOf(container);

    expect(screen.getByRole('heading', { level: 2, name: 'Current roles' })).toBeInTheDocument();
    expect(tile.textContent).not.toMatch(/Founder|ResQ/);
    expect(roleLines()).toEqual([
      `${shown[1]?.position} ${shown[1]?.company} · since 2024`,
      `${shown[2]?.position} ${shown[2]?.company} · since 2024`,
    ]);
    expect(within(tile).getByText(shown[1]?.position ?? '')).toHaveClass('tile-title', 'truncate');
    expect(within(tile).getByText(`${shown[1]?.company} · since 2024`)).toHaveClass(
      'tile-meta',
      'truncate',
    );
  });

  it('links each role to its page, its company as people say it and the year it began', () => {
    const elysium = makeExperience({
      position: 'Freelance Full Stack Developer',
      company: 'Elysium, Inc.',
      current: true,
      startDate: '2023-01-09',
    });
    const [founder] = roles(1);
    if (!founder) throw new Error('no role');
    render(<RolesTileView result={ok({ roles: [founder, elysium], total: 2 })} />);

    // Was 'Elysium · since Jan 2023': the month adds nothing here.
    expect(roleLines()).toEqual(['Freelance Full Stack Developer Elysium · since 2023']);
    expect(screen.getByRole('link', { name: /^Freelance Full Stack Developer/ })).toHaveAttribute(
      'href',
      `/experience/${encodeURIComponent(elysium._id)}`,
    );
  });

  it('counts the current roles named nowhere on the page: +2 more for 5', () => {
    render(<RolesTileView result={ok({ roles: roles(3), total: 5 })} />);
    const more = screen.getByRole('link', { name: '+2 more current roles' });
    expect(more).toHaveAttribute('href', '/experience');
    expect(more).toHaveClass('tile-meta', 'font-medium', 'text-brand-ink');
    expect(screen.getAllByRole('link', { name: /more/ })).toHaveLength(1);
  });

  // CodeRabbit finding #9: with every current role on the page the count line went, and the tile
  // stood 30 px under its skeleton. The empty state's way to every role takes its place.
  it.each([
    ['two roles beside the hero’s', 3],
    ['one role beside the hero’s', 2],
  ])(
    'ends with a link to all experience in the count’s place, with %s and none unnamed',
    (_case, count) => {
      render(<RolesTileView result={ok({ roles: roles(count), total: count })} />);
      expect(screen.queryByRole('link', { name: /more/ })).toBeNull();
      const all = screen.getByRole('link', { name: 'All experience' });
      expect(all).toHaveAttribute('href', '/experience');
      expect(all).toHaveClass('self-start', 'tile-meta', 'font-medium', 'text-brand-ink');
    },
  );

  it('styles the link to all experience as the count it stands in for', () => {
    const counted = render(<RolesTileView result={ok({ roles: roles(3), total: 5 })} />);
    const countClass = screen.getByRole('link', { name: '+2 more current roles' }).className;
    counted.unmount();

    render(<RolesTileView result={ok({ roles: roles(3), total: 3 })} />);
    expect(screen.getByRole('link', { name: 'All experience' }).className).toBe(countClass);
  });

  it('lists the roles one under the other, and side by side from a 32rem tile', () => {
    render(<RolesTileView result={ok({ roles: roles(3), total: 3 })} />);
    expect(screen.getByRole('list')).toHaveClass('grid', '@[32rem]:grid-cols-2');
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.className).not.toMatch(/hidden/);
    }
  });

  it('encodes the document id in each role link', () => {
    const [founder, other] = roles(2);
    if (!(founder && other)) throw new Error('no roles');
    render(
      <RolesTileView
        result={ok({ roles: [founder, { ...other, _id: 'resq/cto 1' }], total: 2 })}
      />,
    );
    expect(screen.getByRole('link', { name: new RegExp(`^${other.position}`) })).toHaveAttribute(
      'href',
      '/experience/resq%2Fcto%201',
    );
  });

  it('says there is no other current role when the hero’s is the only one', () => {
    const { container } = render(<RolesTileView result={ok({ roles: roles(1), total: 1 })} />);
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'empty');
    expect(within(tile).getByText('No other current roles')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: 'All experience' })).toHaveAttribute(
      'href',
      '/experience',
    );
    expect(tile.textContent).not.toMatch(/Founder/);
  });

  // Review finding CR611-8: the hero names its one role undated, so the page said nowhere what
  // day a stale list was from.
  it('says which day stale roles are from when the hero’s is the only one', () => {
    const { container } = render(
      <RolesTileView
        result={ok({ roles: roles(1), total: 1 }, { stale: true, asOf: FIVE_MIN_AGO })}
        now={NOW}
      />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(within(tile).getByText('No other current roles')).toBeInTheDocument();
    const asOf = within(tile).getByText('as of Nov 5');
    expect(asOf).toHaveAttribute('data-dated');
    expect(asOf).toHaveAttribute('data-stale');
    expect(shownChildren(tile).at(-1)).toBe(asOf);
    expect(tile.textContent).not.toMatch(/Founder/);
  });

  it('marks stale the hero’s only role whose load time is unknown, with no line to mark', () => {
    const { container } = render(
      <RolesTileView result={ok({ roles: roles(1), total: 1 }, { stale: true })} now={NOW} />,
    );
    const tile = tileOf(container);
    expect(tile).toHaveAttribute('data-state', 'stale');
    expect(within(tile).getByText('No other current roles')).toBeInTheDocument();
    expect(screen.queryByText(/as of/)).toBeNull();
    expect(container.querySelector('[data-stale]')).toBeNull();
  });

  it('says which day stale roles are from, on its own line after the count', () => {
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
    expect(asOf).toHaveClass('tile-meta');
    expect(shownChildren(tile).at(-1)).toBe(asOf);
  });

  it('prints no day for fresh roles, or for stale ones whose load time is unknown', () => {
    const { container } = render(
      <RolesTileView result={ok({ roles: roles(2), total: 2 })} now={NOW} />,
    );
    expect(tileOf(container)).toHaveAttribute('data-state', 'ready');
    cleanup();

    const stale = render(
      <RolesTileView result={ok({ roles: roles(2), total: 2 }, { stale: true })} now={NOW} />,
    ).container;
    expect(screen.queryByText(/as of/)).toBeNull();
    // Still stale, with no line to mark.
    expect(tileOf(stale)).toHaveAttribute('data-state', 'stale');
    expect(stale.querySelector('[data-stale]')).toBeNull();
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
    for (const [name, href] of [
      ['22 projects', '/projects'],
      ['15 roles', '/experience'],
      ['64 certifications', '/certifications'],
      ['57 places', '/places'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  // The visible 'INDEX' label was cut: the numbers with their names say what the tile is.
  it("names itself 'Site index' for screen readers only, with no visible label", () => {
    const { container } = render(<SiteIndexTileView counts={COUNTS} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Site index' })).toHaveClass('sr-only');
    expect(screen.queryByText(/^index$/i)).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('sets each count as a small figure and its section in lower case beside it', () => {
    render(<SiteIndexTileView counts={COUNTS} />);
    const link = screen.getByRole('link', { name: '64 certifications' });
    expect(within(link).getByText('64')).toHaveClass('figure-sm', 'text-foreground');
    expect(within(link).getByText('certifications')).toHaveClass(
      'figure-unit',
      'text-muted-foreground',
    );
    // In a cell too narrow for both, the name wraps under the figure instead of overflowing.
    expect(link).toHaveClass('flex', 'flex-wrap', 'items-baseline', 'min-w-0');
  });

  // D4: four across only fired in a 16 px band of bentos (a 39rem tile below a 40rem bento),
  // where the estimates were the 2x2 tile's.
  it('is always 2x2, its cells flush to the tile’s edges', () => {
    const { container } = render(<SiteIndexTileView counts={COUNTS} />);
    const list = screen.getByRole('list');
    expect(list).toHaveClass('grid-cols-2');
    expect(list.className).not.toMatch(/grid-cols-(?!2\b)/);
    expect(tileOf(container)).toHaveClass('p-0');
    expect(list).toHaveClass('rounded-[calc(var(--radius-tile)-1px)]', 'overflow-hidden');
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

  // CodeRabbit finding #10: 'certifications' wraps under its figure in a narrow cell, and a
  // one-digit count let it fit where the skeleton's two digits ('00') wrapped it: 19 px apart.
  it('holds two digits’ room for a one-digit count, right-aligned, so its name wraps as the skeleton’s does', () => {
    render(<SiteIndexTileView counts={{ ...COUNTS, certifications: 9 }} />);
    const count = within(screen.getByRole('link', { name: '9 certifications' })).getByText('9');
    expect(count).toHaveClass('figure-sm', 'text-end');
    // A hidden '00' after the digit, in its type: as wide as two digits, no taller than nothing.
    expect(count).toHaveAttribute('data-reserve', '00');
    expect(count).toHaveClass(
      'after:block',
      'after:h-0',
      'after:overflow-hidden',
      'after:invisible',
      'after:content-[attr(data-reserve)]',
    );
    expect(count.textContent).toBe('9');
  });

  // Two digits already fill it: today's counts (22, 15, 64, 57) render exactly as before.
  it('adds nothing to a count of two digits or more', () => {
    render(<SiteIndexTileView counts={{ ...COUNTS, certifications: 164 }} />);
    for (const name of ['22 projects', '15 roles', '164 certifications', '57 places']) {
      const count = screen.getByRole('link', { name }).firstElementChild;
      expect(count).not.toHaveAttribute('data-reserve');
      expect(count?.className).not.toMatch(/after:|text-end/);
    }
  });
});

describe('skeletons', () => {
  it.each(SKELETON_CASES)(
    '%s keeps its real label, is busy and shows no number',
    (label, element) => {
      const { container } = render(element);
      const tile = tileOf(container);
      expect(tile).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeInTheDocument();
      expect(screen.getByText(/^Loading/)).toHaveClass('sr-only');
      expect(container.querySelector('a')).toBeNull();
      // Units are fixed words ('contributions in 12 weeks'), never data.
      expect(textWithout(tile, 'h2, .figure-unit')).not.toMatch(/\d/);
      expectHugs(tile);
    },
  );

  it('holds a figure’s place with its shape in tabular zeros, grouped as the figure will be', () => {
    expect(figureShape(4)).toBe('0,000');
    expect(figureShape(3)).toBe('000');
    expect(figureShape(1)).toBe('0');
    // Not figure spaces: they were 13 px too wide for '1,304' at 48 px (Geist has no U+2007, so
    // they came from the fallback font), and the GitHub skeleton wrapped its unit where the
    // figure did not.
    expect(figureShape(4)).not.toBe(' ,   ');
    expect(figureShape(3)).not.toBe('   ');
  });

  it('draws the shape as hidden generated content, so the document holds no digit', () => {
    const { container } = render(<GitHubTileSkeleton />);
    const placeholder = container.querySelector('.figure-row > [data-shape]');
    expect(placeholder).toHaveAttribute('data-shape', '0,000');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    expect(placeholder).toHaveClass(
      'figure-lg',
      'before:invisible',
      'before:content-[attr(data-shape)]',
    );
    expect(placeholder?.textContent).toBe('');
  });

  // Critic finding forced-colors-skeleton-fake-figures: forced colours repaint transparent text
  // in the system text colour, so '0,000 contributions' and '88% accuracy' read as data.
  it.each(SKELETON_CASES)(
    '%s hides every shape by visibility, never by colour alone',
    (_label, element) => {
      const { container } = render(element);
      for (const placeholder of container.querySelectorAll('[data-shape]')) {
        expect(placeholder).toHaveClass('before:invisible', 'before:content-[attr(data-shape)]');
        expect(placeholder.className).not.toMatch(/(^|\s)(before:)?text-transparent(\s|$)/);
        // Its fill is forced to Canvas there: an outline keeps it a box.
        expect(placeholder).toHaveClass('forced-colors:outline');
      }
    },
  );

  it('keeps a plain skeleton bar a box under forced colours too', () => {
    const { container } = render(<SkeletonBar className="h-4" />);
    expect(container.firstElementChild).toHaveClass('bg-surface-3', 'forced-colors:outline');
  });

  it('sizes the site index’s count placeholders the same way, in the count’s type', () => {
    const { container } = render(<SiteIndexTileSkeleton />);
    const placeholders = [...container.querySelectorAll('[data-shape]')];
    expect(placeholders).toHaveLength(4);
    for (const placeholder of placeholders) {
      expect(placeholder).toHaveAttribute('data-shape', '00');
      expect(placeholder).toHaveClass('figure-sm');
      expect(placeholder.textContent).toBe('');
    }
  });

  // A one-line bar left the skeleton 18 px short in a 181 px lane, where the loaded line wraps.
  it('shapes the typing skeleton’s context line like the loaded one, so it wraps where it does', () => {
    const { container } = render(<TypingTileSkeleton />);
    const placeholder = container.querySelector('p.tile-meta > [data-shape]');
    expect(placeholder).toHaveAttribute('data-shape', typingMeta(88));
    expect(placeholder?.getAttribute('data-shape')).toMatch(/^60 s best · 88% accuracy$/);
    expect(placeholder?.textContent).toBe('');
  });

  /** A tile's rows that take space, each by the type style that sets its height. */
  const TYPE_CLASSES = [
    'tile-label',
    'tile-title',
    'tile-title-lg',
    'tile-sub',
    'tile-meta',
    'figure-row',
  ] as const;
  const rowTypes = (element: Element | null | undefined): string[] =>
    shownChildren(element).map(
      (child) =>
        TYPE_CLASSES.find((type) => child.classList.contains(type)) ??
        (child.hasAttribute('data-segment-bar') ||
        child.hasAttribute('data-segment-bar-placeholder')
          ? 'segment-bar'
          : child.tagName.toLowerCase()),
    );

  // The old skeleton had a line for 'refreshed every 6 h' that the tile no longer has.
  it('LeetCode holds the loaded rows: label, the figure’s row with its unit, the bar', () => {
    const loaded = tileOf(render(<LeetCodeTileView result={ok(LEETCODE)} now={NOW} />).container);
    const loadedRows = rowTypes(loaded);
    cleanup();

    const skeleton = tileOf(render(<LeetCodeTileSkeleton />).container);
    expect(rowTypes(skeleton)).toEqual(loadedRows);
    expect(loadedRows).toEqual(['tile-label', 'figure-row', 'segment-bar']);
    const figure = skeleton.querySelector('.figure-row');
    expect(figure?.firstElementChild).toHaveClass('figure-md', 'before:invisible');
    expect(figure?.lastElementChild?.textContent).toBe('solved');
  });

  it('Typing holds the loaded rows: label, the figure’s row, the meta line', () => {
    const loaded = tileOf(render(<TypingTileView result={ok(TYPING)} now={NOW} />).container);
    const loadedRows = rowTypes(loaded);
    cleanup();

    const skeleton = tileOf(render(<TypingTileSkeleton />).container);
    expect(rowTypes(skeleton)).toEqual(loadedRows);
    expect(loadedRows).toEqual(['tile-label', 'figure-row', 'tile-meta']);
    // Not a fixed one-line box: the meta line's shape wraps where the loaded line does.
    expect(skeleton.querySelector('.tile-meta')).not.toHaveClass('h-[1lh]');
    expect(skeleton.querySelector('.tile-meta > [data-shape]')).not.toBeNull();
  });

  // The old skeleton's bars were about 54px shorter than the loaded tile above a 40rem tile.
  it('GitHub holds the loaded lines: the figure’s row with its unit, the commit’s two, the sparkline', () => {
    const loaded = tileOf(
      render(<GitHubTileView result={ok(ACTIVITY, { asOf: FIVE_MIN_AGO })} now={NOW} />).container,
    );
    const loadedBody = loaded.querySelector('.grid');
    const loadedMain = loadedBody?.firstElementChild;
    const loadedSparkline = loaded.querySelector('[data-sparkline]');
    const shape = {
      rows: rowTypes(loaded),
      body: loadedBody?.className,
      main: rowTypes(loadedMain),
      commit: rowTypes(loadedMain?.lastElementChild),
      unit: loaded.querySelector('.figure-unit')?.textContent,
    };
    cleanup();

    const skeleton = tileOf(render(<GitHubTileSkeleton />).container);
    const body = skeleton.querySelector('.grid');
    const main = body?.firstElementChild;
    expect({
      rows: rowTypes(skeleton),
      body: body?.className,
      main: rowTypes(main),
      commit: rowTypes(main?.lastElementChild),
      unit: skeleton.querySelector('.figure-unit')?.textContent,
    }).toEqual(shape);
    expect(shape.commit).toEqual(['tile-meta', 'tile-sub']);
    expect(main?.querySelector('.figure-row > span')).toHaveClass('figure-lg', 'before:invisible');
    // The sparkline's box: 56 px, and 72 px wherever the loaded one is.
    const box = body?.lastElementChild;
    expect(box).toHaveClass('h-14');
    const tallClasses = (loadedSparkline?.getAttribute('class') ?? '')
      .split(' ')
      .filter((name) => name.endsWith(':h-18'));
    expect(tallClasses).toHaveLength(2);
    expect(box).toHaveClass(...tallClasses);
  });

  it('Recently at holds the loaded row: the 64px photo, then label, name and meta lines', () => {
    const loaded = tileOf(render(<PlaceTileView result={ok(PAST_PLACE)} now={NOW} />).container);
    const loadedRow = shownChildren(loaded)[0];
    const shape = { row: loadedRow?.className, text: rowTypes(loadedRow?.lastElementChild) };
    cleanup();

    const skeleton = tileOf(render(<PlaceTileSkeleton />).container);
    const row = shownChildren(skeleton)[0];
    expect({ row: row?.className, text: rowTypes(row?.lastElementChild) }).toEqual(shape);
    expect(shape.text).toEqual(['tile-label', 'tile-title', 'tile-meta']);
    expect(row?.firstElementChild).toHaveClass('size-16', 'shrink-0');
  });

  it('Featured project holds the loaded media object: the 2:1 cover, label, title and description lines', () => {
    const loaded = tileOf(
      render(<ProjectTileView result={ok(featuredPick(FEATURED))} now={NOW} />).container,
    );
    const loadedMedia = shownChildren(loaded)[0];
    const loadedCoverClasses = (loadedMedia?.firstElementChild?.className ?? '')
      .split(' ')
      .filter((name) => name !== 'object-cover');
    const loadedBody = loadedMedia?.lastElementChild;
    const shape = { media: loadedMedia?.className, body: loadedBody?.className };
    const loadedRows = rowTypes(loadedBody);
    cleanup();

    const skeleton = tileOf(render(<ProjectTileSkeleton />).container);
    const media = shownChildren(skeleton)[0];
    expect({ media: media?.className, body: media?.lastElementChild?.className }).toEqual(shape);
    expect(media?.firstElementChild).toHaveClass(...loadedCoverClasses);
    expect(rowTypes(media?.lastElementChild)).toEqual(loadedRows);
    // The label's row (its h2 and the detail beside it) is one label line.
    expect(loadedRows).toEqual(['tile-label', 'tile-title-lg', 'tile-sub']);
  });

  it('Current roles holds the loaded rows: two roles of a title and a meta line, then the count', () => {
    const loaded = tileOf(
      render(<RolesTileView result={ok({ roles: roles(3), total: 5 })} />).container,
    );
    const loadedList = loaded.querySelector('ul');
    const shape = {
      rows: rowTypes(loaded),
      list: loadedList?.className,
      items: [...(loadedList?.children ?? [])].map((item) => rowTypes(item.firstElementChild)),
    };
    cleanup();

    const skeleton = tileOf(render(<RolesTileSkeleton />).container);
    const list = skeleton.querySelector('ul');
    expect({
      rows: rowTypes(skeleton),
      list: list?.className,
      items: [...(list?.children ?? [])].map((item) => rowTypes(item)),
    }).toEqual(shape);
    expect(shape.items).toEqual([
      ['tile-title', 'tile-meta'],
      ['tile-title', 'tile-meta'],
    ]);
  });

  // With every current role on the page, the link to all experience is the count's line.
  it('Current roles holds the same rows when no role is left unnamed', () => {
    const counted = rowTypes(
      tileOf(render(<RolesTileView result={ok({ roles: roles(3), total: 5 })} />).container),
    );
    cleanup();
    const allNamed = rowTypes(
      tileOf(render(<RolesTileView result={ok({ roles: roles(3), total: 3 })} />).container),
    );
    cleanup();

    expect(allNamed).toEqual(counted);
    expect(rowTypes(tileOf(render(<RolesTileSkeleton />).container))).toEqual(allNamed);
  });

  it('Site index holds the loaded cells: the same grid, a figure’s place and the real name', () => {
    const loaded = tileOf(render(<SiteIndexTileView counts={COUNTS} />).container);
    const loadedGrid = loaded.querySelector('ul')?.className;
    cleanup();

    const skeleton = tileOf(render(<SiteIndexTileSkeleton />).container);
    expect(skeleton.querySelector('ul')?.className).toBe(loadedGrid);
    const cells = [...skeleton.querySelectorAll('li > span')];
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.firstElementChild).toHaveClass('figure-sm', 'before:invisible');
      expect(cell.lastElementChild).toHaveClass('figure-unit');
    }
  });

  // The legend wraps where the loaded one does (it stacks below a 12rem bar).
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
    // Each amount is three tabular zeros in the legend's own type, hidden (segment-bar.tsx): a
    // 3ch bar was 2 px wider than three Geist digits and wrapped the legend where the loaded one
    // did not. No digit is in the document.
    for (const amount of legend.querySelectorAll('dd')) {
      expect(amount.firstElementChild).toHaveAttribute('data-shape', '000');
      expect(amount.firstElementChild).toHaveClass('before:invisible');
      expect(amount.textContent).not.toMatch(/\d/);
    }
  });
});

describe('tile states', () => {
  it('sets a tile label in sentence case, muted, as the tile’s h2', () => {
    render(<TileLabel>Recently at</TileLabel>);
    const label = screen.getByRole('heading', { level: 2, name: 'Recently at' });
    expect(label).toHaveClass('tile-label', 'text-muted-foreground');
    expect(label.className).not.toMatch(/label-mono|uppercase/);
  });

  it('marks an error with a decorative alert glyph in the down colour, beside words', () => {
    const { container } = render(<TileUnavailable message="Places unavailable" />);
    const glyph = container.querySelector('svg');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph).toHaveClass('text-down');
    expect(screen.getByText('Places unavailable')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('tile-sub');
    expect(container.firstElementChild).not.toHaveClass('mt-auto');
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

  // No label is worded from today's date ('Here now' is gone): the visual spec compares every
  // label, and only TileMeta can be marked data-dated.
  it('gives a tile label no `dated`, so no label is ever masked as dated', () => {
    expectTypeOf<TileLabelProps>().not.toHaveProperty('dated');
    const stray = { dated: true } as unknown as TileLabelProps;
    render(<TileLabel {...stray}>Recently at</TileLabel>);
    expect(screen.getByRole('heading', { level: 2, name: 'Recently at' })).not.toHaveAttribute(
      'data-dated',
    );
  });

  it('hides skeleton bars from assistive tech', () => {
    const { container } = render(<SkeletonBar className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('prints nothing for an "as of" time it cannot read', () => {
    expect(asOfText('not a date', NOW)).toBe('');
    expect(asOfText(FIVE_MIN_AGO, NOW)).toBe('as of Nov 5 11:02 AM ET');
  });

  // The no-break space keeps the dot on the line before it when a meta line wraps.
  it('joins only the meta parts that have words, with a no-break space before each dot', () => {
    expect(META_SEPARATOR).toBe(' · ');
    expect(joinMeta(['Conference', null, '', undefined, 'Oct 30'])).toBe('Conference · Oct 30');
  });
});

describe('async tiles', () => {
  it('render what their loaders resolve', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const shownRoles = roles(2);
    loaders.loadLeetCode.mockResolvedValue(ok(LEETCODE));
    loaders.loadTyping.mockResolvedValue(ok(TYPING));
    loaders.loadGitHubActivity.mockResolvedValue(ok(ACTIVITY, { asOf: FIVE_MIN_AGO }));
    loaders.loadProjectPick.mockResolvedValue(ok(activePick(FEATURED)));
    loaders.loadLatestPlace.mockResolvedValue(ok(PAST_PLACE));
    loaders.loadCurrentRoles.mockResolvedValue(ok({ roles: shownRoles, total: 2 }));
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

    expect(screen.getByRole('link', { name: `LeetCode profile ${NEW_TAB}` })).toBeInTheDocument();
    expect(screen.getByText('215')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: `Typing profile on Monkeytype ${NEW_TAB}` }),
    ).toBeInTheDocument();
    expect(screen.getByText('portfolio').parentElement).toHaveTextContent('portfolio · 3 h ago');
    expect(screen.getByRole('link', { name: 'Fraud Guard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Latest work' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Recently at' })).toBeInTheDocument();
    expect(screen.getByText(shownRoles[1]?.position ?? '')).toBeInTheDocument();
    expect(screen.queryByText('Founder & CEO')).toBeNull();
    expect(screen.getByRole('link', { name: '22 projects' })).toBeInTheDocument();
    for (const load of Object.values(loaders)) expect(load).toHaveBeenCalledTimes(1);
  });
});
