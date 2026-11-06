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
 * @file The home page's composition: ten slots in reading order, each in its grid area and
 * holding one tile; one h1 (the hero's); the live islands seeded with the server's snapshots;
 * every data slot behind a boundary whose fallback is that tile's own error state, and a
 * Suspense whose fallback is its skeleton, in the same area. The page stays a server component.
 *
 * The tiles and islands are stubs, so this checks the page and not them. The page is rendered
 * with react-dom/static's prerender, which waits for every async slot as the server does, then
 * parsed into jsdom; renderToString gives the first flush, where a slot still loading shows its
 * skeleton. SectionBoundary is a stub that records its label and fallback (the real one needs
 * the app router).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface StubResult {
  status: string;
}

const h = vi.hoisted(() => {
  const pending = new Promise<never>(() => {});
  /** Areas whose tile never finishes loading in this test. */
  const suspended = new Set<string>();
  /** SectionBoundary's props, by label, in the order the page rendered them. */
  const boundaries = new Map<string, { fallback: unknown }>();

  /**
   * A server tile's three exports: the tile (or an endless wait), its skeleton and its view.
   * Lower-case keys: they stand in for components, but are made per area here.
   */
  const stubTile = (area: string, label: string) => ({
    tile: (): ReactElement | Promise<never> =>
      suspended.has(area) ? (
        pending
      ) : (
        <article data-tile={area}>
          <h2>{label}</h2>
          <a href={`/${area}`}>{label}</a>
        </article>
      ),
    skeleton: (): ReactElement => <div data-skeleton={area} aria-busy="true" />,
    view: ({ result, counts }: { result?: StubResult; counts?: unknown }): ReactElement => (
      <div
        data-fallback={area}
        data-status={result?.status}
        data-counts={counts === undefined ? undefined : JSON.stringify(counts)}
      />
    ),
  });

  /** A live island and its skeleton. The island shows which snapshot it was given. */
  const stubIsland = (area: string, label: string) => ({
    island: ({ initial }: { initial: { kind: string } }): ReactElement => (
      <article data-tile={area} data-initial={initial.kind}>
        <h2>{label}</h2>
      </article>
    ),
    skeleton: (): ReactElement => <div data-skeleton={area} aria-busy="true" />,
  });

  return {
    pending,
    suspended,
    boundaries,
    stubTile,
    stubIsland,
    loadNowPlaying: vi.fn(),
    loadServiceStatus: vi.fn(),
  };
});

// Vite cannot load the repo's PostCSS config (Next's string-plugin form), so the module's class
// names are stood in for: each class `name` becomes `bento-<name>`.
vi.mock('@/app/_components/home/bento.module.css', () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? `bento-${name}` : undefined),
  }),
}));
vi.mock('@/components/data/section-boundary', () => ({
  SectionBoundary: ({
    label,
    fallback,
    children,
  }: {
    label: string;
    fallback?: ReactNode;
    children: ReactNode;
  }) => {
    h.boundaries.set(label, { fallback });
    return children;
  },
}));
vi.mock('@/app/_components/home/data/loaders', () => ({
  loadNowPlaying: h.loadNowPlaying,
  loadServiceStatus: h.loadServiceStatus,
}));
vi.mock('@/app/_components/home/live/now-playing-tile', () => {
  const now = h.stubIsland('now', 'Now playing');
  return { NowPlayingTile: now.island, NowPlayingTileSkeleton: now.skeleton };
});
vi.mock('@/app/_components/home/live/status-tile', () => {
  const status = h.stubIsland('status', 'Status');
  return { StatusTile: status.island, StatusTileSkeleton: status.skeleton };
});
vi.mock('@/app/_components/home/tiles/hero-tile', () => ({
  HeroTile: () => (
    <div data-tile="hero">
      <h1>Mike Odnis</h1>
      <a href="mailto:hello@example.com">Email me</a>
    </div>
  ),
}));
vi.mock('@/app/_components/home/tiles/metric-tiles', () => {
  const leet = h.stubTile('leet', 'LeetCode');
  const type = h.stubTile('type', 'Typing');
  return {
    LeetCodeTile: leet.tile,
    LeetCodeTileSkeleton: leet.skeleton,
    LeetCodeTileView: leet.view,
    TypingTile: type.tile,
    TypingTileSkeleton: type.skeleton,
    TypingTileView: type.view,
  };
});
vi.mock('@/app/_components/home/tiles/github-tile', () => {
  const gh = h.stubTile('gh', 'GitHub');
  return { GitHubTile: gh.tile, GitHubTileSkeleton: gh.skeleton, GitHubTileView: gh.view };
});
vi.mock('@/app/_components/home/tiles/project-tile', () => {
  const proj = h.stubTile('proj', 'Featured project');
  return { ProjectTile: proj.tile, ProjectTileSkeleton: proj.skeleton, ProjectTileView: proj.view };
});
vi.mock('@/app/_components/home/tiles/place-tile', () => {
  const place = h.stubTile('place', 'Last place');
  return { PlaceTile: place.tile, PlaceTileSkeleton: place.skeleton, PlaceTileView: place.view };
});
vi.mock('@/app/_components/home/tiles/roles-tile', () => {
  const role = h.stubTile('role', 'Current roles');
  return { RolesTile: role.tile, RolesTileSkeleton: role.skeleton, RolesTileView: role.view };
});
vi.mock('@/app/_components/home/tiles/site-index-tile', () => {
  const strip = h.stubTile('strip', 'Site index');
  return {
    SiteIndexTile: strip.tile,
    SiteIndexTileSkeleton: strip.skeleton,
    SiteIndexTileView: strip.view,
    UNKNOWN_SITE_COUNTS: { projects: null, roles: null, certifications: null, places: null },
  };
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

import styles from '@/app/_components/home/bento.module.css';
import { HomePage } from '@/app/_components/home/home-page';

const PAGE_SOURCE = path.resolve(__dirname, '../../../src/app/_components/home/home-page.tsx');

/** The slots in reading order. */
const AREAS = ['hero', 'now', 'status', 'leet', 'type', 'gh', 'proj', 'place', 'role', 'strip'];

/** The nine data slots: every slot but the hero, each behind its own Suspense. */
const DATA_AREAS = AREAS.filter((area) => area !== 'hero');

/** The live islands' slots, whose content waits on a loader (mocked here) before it renders. */
const LIVE_AREAS = ['now', 'status'];

/** The server tiles' slots: their stubs render at once unless their area is in h.suspended. */
const SERVER_TILE_AREAS = DATA_AREAS.filter((area) => !LIVE_AREAS.includes(area));

/** The data slots' boundary labels, in the same order (the hero has no boundary). */
const BOUNDARY_LABELS = [
  'Now playing',
  'Status',
  'LeetCode',
  'Typing',
  'GitHub activity',
  // The tile itself says 'Latest work' or 'Featured project'; the slot names neither.
  'Project',
  'Last place',
  'Current roles',
  'Site index',
];

const NOW_PLAYING_SNAPSHOT = { kind: 'data', data: { isPlaying: false }, fetchedAt: 1 } as const;
const STATUS_SNAPSHOT = { kind: 'timeout' } as const;

/** The page's HTML once every Suspense boundary has resolved, as the server streams it. */
async function renderPageHtml(): Promise<void> {
  const { prelude } = await prerender(<HomePage />);
  document.body.innerHTML = await new Response(prelude).text();
}

/** The page's first flush: slots still loading show their fallback. */
function renderFirstFlush(): void {
  document.body.innerHTML = renderToString(<HomePage />);
}

const slots = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-bento-slot]')];

function slot(area: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-bento-slot="${area}"]`);
  if (!found) throw new Error(`no ${area} slot`);
  return found;
}

/** Makes `area`'s content wait forever: a live island's loader, or a server tile's stub. */
function suspend(area: string): void {
  if (area === 'now') h.loadNowPlaying.mockReturnValue(h.pending);
  else if (area === 'status') h.loadServiceStatus.mockReturnValue(h.pending);
  else h.suspended.add(area);
}

/** A recorded boundary fallback, rendered on its own into an element after the page. */
function fallbackOf(label: string): HTMLElement {
  const boundary = h.boundaries.get(label);
  if (!boundary) throw new Error(`no boundary labelled ${label}`);
  const host = document.createElement('div');
  host.innerHTML = renderToString(boundary.fallback as ReactElement);
  document.body.append(host);
  return host;
}

beforeEach(() => {
  h.loadNowPlaying.mockResolvedValue(NOW_PLAYING_SNAPSHOT);
  h.loadServiceStatus.mockResolvedValue(STATUS_SNAPSHOT);
});

afterEach(() => {
  document.body.innerHTML = '';
  h.suspended.clear();
  h.boundaries.clear();
  vi.clearAllMocks();
});

describe('HomePage layout', () => {
  it('renders the ten slots in reading order, each with its area class', async () => {
    await renderPageHtml();

    expect(slots().map((element) => element.dataset.bentoSlot)).toEqual(AREAS);
    for (const element of slots()) {
      const area = element.dataset.bentoSlot ?? '';
      expect(element).toHaveClass(styles.slot ?? '', styles[area] ?? '');
      expect(styles[area]).toBeTruthy();
    }
  });

  it('puts the slots straight into the grid, inside the bento container', async () => {
    await renderPageHtml();
    const grid = slots()[0]?.parentElement;

    expect(grid).toHaveClass(styles.grid ?? '');
    expect(grid?.children).toHaveLength(AREAS.length);
    expect(grid?.parentElement).toHaveClass(styles.container ?? '');
    expect(document.body.firstElementChild).toBe(grid?.parentElement);
  });

  it('gives each slot exactly one element: its own tile', async () => {
    await renderPageHtml();

    for (const area of AREAS) {
      const element = slot(area);
      expect(element.children).toHaveLength(1);
      expect(element.firstElementChild).toHaveAttribute('data-tile', area);
    }
  });

  it('has exactly one h1, the hero’s, and no landmarks of its own', async () => {
    await renderPageHtml();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Mike Odnis');
    expect(within(slot('hero')).getByRole('heading', { level: 1 })).toBe(headings[0]);
    expect(document.querySelector('main, section, nav, header, footer, aside')).toBeNull();
  });

  it('links nowhere empty, loaded or failed: no href of # or nothing', async () => {
    await renderPageHtml();
    for (const label of h.boundaries.keys()) fallbackOf(label);

    const links = [...document.querySelectorAll('a')];
    // One per stub with a link (the hero and the seven server tiles), and one per live fallback.
    expect(links).toHaveLength(8 + 2);
    for (const link of links) expect(['', '#']).not.toContain(link.getAttribute('href'));
  });
});

describe('HomePage live slots', () => {
  it('seeds each island with the server snapshot its loader gave', async () => {
    await renderPageHtml();

    expect(h.loadNowPlaying).toHaveBeenCalledTimes(1);
    expect(h.loadServiceStatus).toHaveBeenCalledTimes(1);
    expect(slot('now').firstElementChild).toHaveAttribute('data-initial', 'data');
    expect(slot('status').firstElementChild).toHaveAttribute('data-initial', 'timeout');
  });

  it('shows the islands’ skeletons in the first flush, before the snapshots arrive', () => {
    renderFirstFlush();

    expect(slot('now').querySelector('[data-skeleton="now"]')).not.toBeNull();
    expect(slot('status').querySelector('[data-skeleton="status"]')).not.toBeNull();
    expect(slot('now').querySelector('[data-tile]')).toBeNull();
  });
});

describe('HomePage loading and failure', () => {
  it.each(DATA_AREAS)(
    'shows the %s slot’s own skeleton in its area while its tile is loading',
    (area) => {
      suspend(area);
      renderFirstFlush();

      expect(slot(area).querySelector(`[data-skeleton="${area}"]`)).toHaveAttribute(
        'aria-busy',
        'true',
      );
      expect(slot(area).querySelector('[data-tile]')).toBeNull();
      expect(document.querySelectorAll(`[data-skeleton="${area}"]`)).toHaveLength(1);
      // Only this slot waits: every other server tile is in the first flush.
      for (const other of SERVER_TILE_AREAS.filter((name) => name !== area)) {
        expect(slot(other).querySelector(`[data-tile="${other}"]`), other).not.toBeNull();
      }
    },
  );

  it('puts every data slot, but not the hero, behind a labelled boundary', async () => {
    await renderPageHtml();

    expect([...h.boundaries.keys()]).toEqual(BOUNDARY_LABELS);
  });

  it('falls back to each server tile’s own error state', async () => {
    await renderPageHtml();
    const tiles: readonly [string, string][] = [
      ['LeetCode', 'leet'],
      ['Typing', 'type'],
      ['GitHub activity', 'gh'],
      ['Project', 'proj'],
      ['Last place', 'place'],
      ['Current roles', 'role'],
    ];

    for (const [label, area] of tiles) {
      const view = fallbackOf(label).querySelector(`[data-fallback="${area}"]`);
      expect(view, label).toHaveAttribute('data-status', 'error');
    }
  });

  it('falls back to the site index with every count unknown, so no number is made up', async () => {
    await renderPageHtml();
    const view = fallbackOf('Site index').querySelector('[data-fallback="strip"]');

    expect(JSON.parse(view?.getAttribute('data-counts') ?? '{}')).toEqual({
      projects: null,
      roles: null,
      certifications: null,
      places: null,
    });
  });

  it('falls back to a static now-playing tile: its label, words, and a way to top tracks', async () => {
    await renderPageHtml();
    const fallback = fallbackOf('Now playing');

    expect(within(fallback).getByRole('heading', { level: 2 })).toHaveTextContent('Now playing');
    expect(within(fallback).getByText('Now playing unavailable')).toBeInTheDocument();
    const link = within(fallback).getByRole('link', { name: 'Top tracks' });
    expect(link).toHaveAttribute('href', '/spotify');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(fallback.textContent).not.toMatch(/\d/);
    expect(fallback.textContent).not.toMatch(/retrying/i);
  });

  it('falls back to a static status tile linking to the status page in a new tab', async () => {
    await renderPageHtml();
    const fallback = fallbackOf('Status');

    expect(within(fallback).getByRole('heading', { level: 2 })).toHaveTextContent('Status');
    expect(within(fallback).getByText('Status unavailable')).toBeInTheDocument();
    const link = within(fallback).getByRole('link', { name: 'Status page (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://status.mikeodnis.dev');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('home-page.tsx', () => {
  const source = readFileSync(PAGE_SOURCE, 'utf8');

  it('is a server component: no use client directive, and server-only', () => {
    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
    expect(source).toMatch(/^import 'server-only';$/m);
  });
});
