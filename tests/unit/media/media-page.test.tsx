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
 * @file /media renders on the server: the page loads only the active tab's list and renders its
 * panel (an unknown ?tab= gives the blog), the panels carry no hidden motion entrance and no
 * filler videos, the first card image loads eagerly, a failed load costs only the panel, and
 * the tab bar switches tabs with a pushed, non-shallow ?tab= navigation. The blog list keeps its
 * last good answer when its sources fail. The page needs no loading.tsx: it awaits only its
 * search params, and its panel streams behind the active tab's own skeleton.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { makeArticle, makePresentation, makeTalk, makeVideo } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { cloneElement, isValidElement, type ReactElement, type ReactNode, use } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const { loaders, fetchBlogs, reportApiFailure } = vi.hoisted(() => ({
  loaders: {
    loadPresentations: vi.fn(),
    loadTalks: vi.fn(),
    loadVideos: vi.fn(),
    loadArticles: vi.fn(),
  },
  fetchBlogs: vi.fn(),
  reportApiFailure: vi.fn(() => true),
}));

vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/app/api/v1/[[...route]]/blog/handlers', () => ({ fetchBlogs }));
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportApiFailure,
  reportError: vi.fn(() => true),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/** The filler videos the API once served when Sanity had none (Rick Astley, the zoo, a talk). */
const PLACEHOLDER_VIDEO_IDS = ['dQw4w9WgXcQ', 'jjMbPt_H3RQ', 'jNQXAC9IVRw'] as const;
/** Motion's hidden entrance state serialized into server HTML (but not MagicCard's opacity:0.8). */
const HIDDEN_ENTRANCE = /opacity:\s*0(?![.\d])/;
const MINUTE_MS = 60_000;

const makePost = (overrides: Partial<Blog> = {}): Blog => ({
  title: 'Beyond Static: A Dynamic Portfolio',
  slug: 'beyond-static-a-dynamic-portfolio',
  publishedAt: '2024-09-26T15:27:57.000Z',
  excerpt: 'How the portfolio renders live data.',
  imageUrl: 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/static-cover.png',
  source: 'hashnode',
  ...overrides,
});

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROUTE_DIR = join(process.cwd(), 'src/app/(routes)/(dev)/media');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'] as const;

const loadPageModule = () => import('@/app/(routes)/(dev)/media/page');
const loadPanelModule = () => import('@/app/(routes)/(dev)/media/_components/media-panel');
const loadBlogModule = () => import('@/app/(routes)/(dev)/media/_lib/load-media');

type AsyncComponent = (props: unknown) => Promise<ReactNode>;

const isAsyncComponent = (type: unknown): type is AsyncComponent =>
  typeof type === 'function' && type.constructor.name === 'AsyncFunction';

/** Throws `error` where it renders, so the nearest client error boundary catches it. */
const Rejected = ({ error }: { readonly error: unknown }): never => {
  throw error;
};

/** What Flight sends for a server component that rejected: a node that throws on the client. */
const thrownOnRender = (error: unknown): ReactElement => <Rejected error={error} />;

/**
 * Renders a server tree's async components (awaiting each, like the RSC renderer), and leaves
 * the client components and the plain function components to React. A rejection becomes a node
 * that throws where the component stood, so the nearest client error boundary catches it.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
  if (!isValidElement(node)) return node;
  if (isAsyncComponent(node.type)) {
    const rendered = await node.type(node.props).catch(thrownOnRender);
    return resolveServerTree(rendered);
  }
  const entries = await Promise.all(
    Object.entries(node.props as Record<string, unknown>).map(
      async ([key, value]) =>
        [
          key,
          isValidElement(value) || Array.isArray(value)
            ? await resolveServerTree(value as ReactNode)
            : value,
        ] as const,
    ),
  );
  return cloneElement(node, Object.fromEntries(entries));
}

/** /media for `searchParams`, rendered as the browser would get it. */
async function renderMediaPage(
  searchParams: Record<string, string | string[] | undefined>,
  query = '',
): Promise<void> {
  const { default: MediaPage } = await loadPageModule();
  const page = await MediaPage({ searchParams: Promise.resolve(searchParams) });
  render(
    <NuqsTestingAdapter searchParams={query}>{await resolveServerTree(page)}</NuqsTestingAdapter>,
  );
}

/** Holds a server component's unsettled result, so the nearest Suspense shows its fallback. */
const Pending = ({ result }: { readonly result: Promise<ReactNode> }): ReactNode => use(result);

/**
 * The server tree as the browser has it before its async components finish: each one is left
 * pending where it stands, so every Suspense boundary above one shows its fallback.
 */
function pendingServerTree(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(pendingServerTree);
  if (!isValidElement(node)) return node;
  if (isAsyncComponent(node.type)) return <Pending result={node.type(node.props)} />;
  const entries = Object.entries(node.props as Record<string, unknown>).map(
    ([key, value]) =>
      [
        key,
        isValidElement(value) || Array.isArray(value)
          ? pendingServerTree(value as ReactNode)
          : value,
      ] as const,
  );
  return cloneElement(node, Object.fromEntries(entries));
}

/** /media for `searchParams` while its panel is still loading, as the browser first shows it. */
async function renderPendingMediaPage(
  searchParams: Record<string, string | string[] | undefined>,
  query: string,
): Promise<void> {
  const { default: MediaPage } = await loadPageModule();
  const page = await MediaPage({ searchParams: Promise.resolve(searchParams) });
  render(<NuqsTestingAdapter searchParams={query}>{pendingServerTree(page)}</NuqsTestingAdapter>);
}

/** `node`'s markup, rendered outside the page so the page's queries don't see it. */
const detachedHtml = (node: ReactElement): string =>
  render(node, { container: document.createElement('div') }).container.innerHTML;

const visiblePanel = (): HTMLElement => screen.getByRole('tabpanel');

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  loaders.loadPresentations.mockResolvedValue([makePresentation({ title: 'Presenting Effect' })]);
  loaders.loadTalks.mockResolvedValue([
    makeTalk({ title: 'Server Components in Practice' }),
    makeTalk({ title: 'Streaming the Portfolio' }),
  ]);
  loaders.loadVideos.mockResolvedValue([makeVideo({ title: 'Building the Live Console' })]);
  loaders.loadArticles.mockResolvedValue([makeArticle({ title: 'Typed Errors with Effect' })]);
  fetchBlogs.mockResolvedValue([makePost()]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/media page', () => {
  it('?tab=talks loads talks alone and renders them as the selected panel', async () => {
    await renderMediaPage({ tab: 'talks' }, '?tab=talks');

    expect(loaders.loadTalks).toHaveBeenCalledTimes(1);
    expect(loaders.loadPresentations).not.toHaveBeenCalled();
    expect(loaders.loadVideos).not.toHaveBeenCalled();
    expect(loaders.loadArticles).not.toHaveBeenCalled();
    expect(fetchBlogs).not.toHaveBeenCalled();

    expect(screen.getByRole('tab', { name: 'Talks' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(visiblePanel());
    expect(panel.getByText('Server Components in Practice')).toBeInTheDocument();
    expect(panel.getByText('Streaming the Portfolio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Media' })).toBeInTheDocument();
  });

  it.each([
    ['an unknown ?tab=', { tab: 'bogus' }],
    ['no ?tab=', {}],
    ['a repeated ?tab=', { tab: ['talks', 'videos'] }],
  ])('%s renders the blog panel', async (_case, searchParams) => {
    await renderMediaPage(searchParams);

    expect(fetchBlogs).toHaveBeenCalledTimes(1);
    expect(loaders.loadTalks).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Blog posts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      within(visiblePanel()).getByText('Beyond Static: A Dynamic Portfolio'),
    ).toBeInTheDocument();
  });

  it('a failed load costs only the panel: the header and the tab bar stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loaders.loadTalks.mockRejectedValue(new Error('Sanity is down'));

    await renderMediaPage({ tab: 'talks' }, '?tab=talks');

    expect(within(visiblePanel()).getByText("Couldn't load talks")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Media' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(document.body.textContent).not.toContain('Sanity is down');
  });

  it('?tab=talks shows the header, the tab bar and the talks skeleton while talks load', async () => {
    loaders.loadTalks.mockReturnValue(new Promise(() => {}));
    const { MediaPanelSkeleton } = await loadPanelModule();

    await renderPendingMediaPage({ tab: 'talks' }, '?tab=talks');

    expect(screen.getByRole('heading', { level: 1, name: 'Media' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Talks' })).toHaveAttribute('aria-selected', 'true');
    const talksSkeleton = detachedHtml(<MediaPanelSkeleton tab="talks" />);
    expect(talksSkeleton).not.toBe(detachedHtml(<MediaPanelSkeleton tab="blog" />));
    expect(visiblePanel().firstElementChild?.innerHTML).toBe(talksSkeleton);
  });

  it('has no loading.tsx, whose one skeleton would sit under any tab', () => {
    const present = LOADING_FILES.filter((file) => existsSync(join(ROUTE_DIR, file)));

    expect(present).toEqual([]);
  });
});

describe('/media panels', () => {
  it.each([
    ['blog', 'Beyond Static: A Dynamic Portfolio'],
    ['presentations', 'Presenting Effect'],
    ['talks', 'Server Components in Practice'],
    ['videos', 'Building the Live Console'],
    ['articles', 'Typed Errors with Effect'],
  ] as const)('the %s panel is visible in server HTML (no opacity:0)', async (tab, title) => {
    const { MediaPanel } = await loadPanelModule();

    const html = renderToString(await MediaPanel({ tab }));

    expect(html).toContain(title);
    expect(html).not.toMatch(HIDDEN_ENTRANCE);
  });

  it('the videos panel lists only the loaded videos, never the placeholder ones', async () => {
    const { MediaPanel } = await loadPanelModule();
    loaders.loadVideos.mockResolvedValueOnce([makeVideo({ videoId: 'aB3dE5gH7jK' })]);
    loaders.loadVideos.mockResolvedValueOnce([]);

    const listed = renderToString(await MediaPanel({ tab: 'videos' }));
    const empty = renderToString(await MediaPanel({ tab: 'videos' }));

    expect(listed).toContain('aB3dE5gH7jK');
    expect(empty).toContain('No videos available yet.');
    for (const id of PLACEHOLDER_VIDEO_IDS) {
      expect(listed).not.toContain(id);
      expect(empty).not.toContain(id);
    }
  });

  it('loads the first card image eagerly at high priority and the rest lazily', async () => {
    const { MediaPanel } = await loadPanelModule();
    loaders.loadVideos.mockResolvedValueOnce([
      makeVideo({ title: 'Thumbnail one' }),
      makeVideo({ title: 'Thumbnail two' }),
      makeVideo({ title: 'Thumbnail three' }),
    ]);

    render(await MediaPanel({ tab: 'videos' }));

    const [first, ...rest] = screen.getAllByRole('img', { name: /^Thumbnail / });
    expect(rest).toHaveLength(2);
    expect(first).toHaveAttribute('loading', 'eager');
    expect(first).toHaveAttribute('fetchpriority', 'high');
    for (const image of rest) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).not.toHaveAttribute('fetchpriority');
    }
  });

  it("gives the blog's first cover the priority, skipping posts without one", async () => {
    const { MediaPanel } = await loadPanelModule();
    fetchBlogs.mockResolvedValueOnce([
      makePost({ slug: 'no-cover', title: 'No cover', imageUrl: undefined }),
      makePost({ slug: 'first-cover', title: 'First cover' }),
      makePost({ slug: 'second-cover', title: 'Second cover' }),
    ]);

    render(await MediaPanel({ tab: 'blog' }));

    expect(screen.getByRole('img', { name: 'First cover' })).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('img', { name: 'Second cover' })).toHaveAttribute('loading', 'lazy');
  });
});

describe('MediaTabs', () => {
  const renderTabs = async (active: 'blog' | 'talks', onUrlUpdate = vi.fn()) => {
    const { MediaTabs } = await import('@/app/(routes)/(dev)/media/_components/media-tabs');
    render(
      <NuqsTestingAdapter searchParams={`?tab=${active}`} onUrlUpdate={onUrlUpdate}>
        <MediaTabs active={active}>
          <p>Server-rendered panel</p>
        </MediaTabs>
      </NuqsTestingAdapter>,
    );
    return onUrlUpdate;
  };

  const lastUrlUpdate = (onUrlUpdate: ReturnType<typeof vi.fn>): UrlUpdateEvent =>
    onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;

  it('choosing Videos pushes ?tab=videos as a server navigation, without scrolling', async () => {
    const onUrlUpdate = await renderTabs('blog');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Videos' }));

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = lastUrlUpdate(onUrlUpdate);
    expect(update.searchParams.get('tab')).toBe('videos');
    expect(update.options.shallow).toBe(false);
    expect(update.options.history).toBe('push');
    expect(update.options.scroll).toBe(false);
    // The server's tab stays selected until its new panel arrives.
    expect(screen.getByRole('tab', { name: 'Blog posts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('choosing Blog drops ?tab= for the plain /media URL', async () => {
    const onUrlUpdate = await renderTabs('talks');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Blog posts' }));

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastUrlUpdate(onUrlUpdate).searchParams.has('tab')).toBe(false);
  });

  it('renders the panel once, in the active tab only', async () => {
    await renderTabs('talks');

    expect(screen.getAllByText('Server-rendered panel')).toHaveLength(1);
    expect(within(visiblePanel()).getByText('Server-rendered panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Talks' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('loadBlogPosts', () => {
  const START = Date.UTC(2026, 10, 5, 12);

  beforeEach(() => {
    vi.useFakeTimers({ now: START, toFake: ['Date'] });
  });

  it('asks the blog sources once per 30 minutes', async () => {
    const { loadBlogPosts } = await loadBlogModule();

    await loadBlogPosts();
    vi.setSystemTime(START + 29 * MINUTE_MS);
    await loadBlogPosts();

    expect(fetchBlogs).toHaveBeenCalledTimes(1);
  });

  it('serves the last good list, with one warning, when the sources fail after a success', async () => {
    const { loadBlogPosts } = await loadBlogModule();
    const good = [makePost()];
    fetchBlogs.mockResolvedValueOnce(good);
    await loadBlogPosts();

    vi.setSystemTime(START + 31 * MINUTE_MS);
    fetchBlogs.mockRejectedValueOnce(new Error('Failed to fetch blogs from any source'));

    await expect(loadBlogPosts()).resolves.toEqual(good);
    expect(fetchBlogs).toHaveBeenCalledTimes(2);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'blog:posts' }),
      { context: 'load blog for pages', level: 'warning' },
    );
  });

  it("rejects with the sources' error, reporting nothing itself, when nothing is cached", async () => {
    const { loadBlogPosts } = await loadBlogModule();
    const outage = new Error('Failed to fetch blogs from any source');
    fetchBlogs.mockRejectedValueOnce(outage);

    await expect(loadBlogPosts()).rejects.toBe(outage);
    expect(reportApiFailure).not.toHaveBeenCalled();
  });
});
