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
 * @file The media about one project, as its own page loads it (load-project-media.ts): the same
 * relations /media shows, newest first, never a proposal; and a load that can neither hold the
 * project page up nor bring it down. A source still reloading at the deadline answers with its
 * last cached list, so the block lists the same items on every answer once a list was ever
 * cached; only a cold server's first answer can be short. Only the loaders, their peeks and the
 * hand-written map are mocked.
 */

import { makeProject, makeVideo } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const { loaders, loadFeedPosts, peekFeedPosts, reportApiFailure, map, after } = vi.hoisted(() => ({
  /** Next's after(): what the page hands over to keep running once its response has ended. */
  after: vi.fn(),
  loaders: {
    loadVideos: vi.fn(),
    loadProjects: vi.fn(),
    peekVideos: vi.fn(),
    peekProjects: vi.fn(),
  },
  loadFeedPosts: vi.fn(),
  peekFeedPosts: vi.fn(),
  reportApiFailure: vi.fn(() => true),
  map: {
    links: [] as { item: string; project: string; proposed?: true }[],
    /** Set to make reading the map throw, as a broken rule would. */
    broken: false,
  },
}));

vi.mock('next/server', () => ({ after }));
vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/app/(routes)/(dev)/media/_lib/load-media', () => ({ loadFeedPosts, peekFeedPosts }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure }));
vi.mock('@/app/(routes)/(dev)/media/_lib/media-project-links', () => ({
  MEDIA_PROJECT_RULES: {
    get links() {
      if (map.broken) throw new Error('the map cannot be read');
      return map.links;
    },
    notLinks: [],
  },
}));

import {
  loadProjectMedia,
  PROJECT_MEDIA_DEADLINE_MS,
  PROJECT_MEDIA_MAX,
} from '@/app/(routes)/(dev)/media/_lib/load-project-media';

const REPO = 'https://github.com/example/decoder';
const DECODER = makeProject({ _id: 'decoder', title: 'Product Decoder', githubUrl: REPO });
const OTHER = makeProject({ _id: 'other', title: 'Other Thing', liveUrl: 'https://other.example' });

const video = (name: string, overrides: Parameters<typeof makeVideo>[0] = {}) =>
  makeVideo({
    _id: name,
    videoId: name.padEnd(11, '0').slice(0, 11),
    title: `Video ${name}`,
    description: '',
    publishedDate: '2025-04-01T00:00:00Z',
    ...overrides,
  });

const POST: Blog = {
  title: 'How the decoder works',
  slug: 'how-the-decoder-works',
  publishedAt: '2025-06-01T00:00:00.000Z',
  excerpt: `Code: ${REPO}`,
  source: 'hashnode',
  url: 'https://blog.example.dev/how-the-decoder-works',
};

const VIDEOS = [
  video('overview', { title: 'Decoder - Overview', description: `Source: ${REPO}` }),
  video('unrelated', { title: 'Product Decoder tips', description: 'No link here.' }),
  video('elsewhere', { description: 'https://other.example' }),
];
const PROJECTS = [DECODER, OTHER];

const POST_ID = 'post:https://blog.example.dev/how-the-decoder-works';

/** A load that is still running: a reload past its cache's TTL, or a cold source, that is slow. */
const never = <T>(): Promise<T> => new Promise<T>(() => {});
/** A list as a cache's peek answers it: the last one loaded, however old. */
const cached = <T>(data: readonly T[]) => ({ data, loadedAt: 0 });

/** Every source is still loading; what each peek answers is the test's own business. */
const allSlow = (): void => {
  loaders.loadVideos.mockReturnValue(never());
  loaders.loadProjects.mockReturnValue(never());
  loadFeedPosts.mockReturnValue(never());
};

/**
 * What `load` answers and how long it took on the faked clock, once the deadline has passed. A
 * load that waits any longer never settles here, so the test fails on its timeout.
 */
async function atDeadline<T>(load: Promise<T>): Promise<{ answer: T; tookMs: number }> {
  const startedAt = Date.now();
  const settled = load.then((answer) => ({ answer, tookMs: Date.now() - startedAt }));
  await vi.advanceTimersByTimeAsync(PROJECT_MEDIA_DEADLINE_MS);
  return settled;
}

beforeEach(() => {
  map.links = [];
  map.broken = false;
  loaders.loadProjects.mockResolvedValue(PROJECTS);
  loaders.loadVideos.mockResolvedValue(VIDEOS);
  loadFeedPosts.mockResolvedValue([POST]);
  // A cold server unless a test says otherwise: no list was ever cached.
  loaders.peekProjects.mockReturnValue(undefined);
  loaders.peekVideos.mockReturnValue(undefined);
  peekFeedPosts.mockReturnValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('loadProjectMedia', () => {
  it("lists what links the project, newest first, each with the piece's own address", async () => {
    expect(await loadProjectMedia('decoder')).toEqual([
      {
        id: POST_ID,
        kind: 'post',
        title: 'How the decoder works',
        href: 'https://blog.example.dev/how-the-decoder-works',
      },
      {
        id: 'video:overview',
        kind: 'video',
        title: 'Decoder - Overview',
        href: 'https://www.youtube.com/watch?v=overview000',
      },
    ]);
  });

  it('lists nothing for a project nothing is about, or one that does not exist', async () => {
    loaders.loadVideos.mockResolvedValue([video('unrelated', { title: 'Other Thing tips' })]);
    loadFeedPosts.mockResolvedValue([]);

    expect(await loadProjectMedia('other')).toEqual([]);
    expect(await loadProjectMedia('nope')).toEqual([]);
  });

  it('follows a confirmed line of the map, and never a proposal', async () => {
    map.links = [
      { item: 'unrelated00', project: 'decoder' },
      { item: 'elsewhere00', project: 'decoder', proposed: true },
    ];

    expect((await loadProjectMedia('decoder')).map((item) => item.id)).toEqual([
      POST_ID,
      'video:overview',
      'video:unrelated',
    ]);
    // The proposal left the video where its own link puts it.
    expect((await loadProjectMedia('other')).map((item) => item.id)).toEqual(['video:elsewhere']);
  });

  it(`lists ${PROJECT_MEDIA_MAX} items at most`, async () => {
    loaders.loadVideos.mockResolvedValue(
      Array.from({ length: PROJECT_MEDIA_MAX + 3 }, (_, n) => video(`extra${n}`)),
    );
    loadFeedPosts.mockResolvedValue([]);
    map.links = Array.from({ length: PROJECT_MEDIA_MAX + 3 }, (_, n) => ({
      item: `extra${n}`.padEnd(11, '0'),
      project: 'decoder',
    }));

    expect(await loadProjectMedia('decoder')).toHaveLength(PROJECT_MEDIA_MAX);
  });

  it('answers without a source that fails, and reports it as a warning', async () => {
    loadFeedPosts.mockRejectedValue(new Error('Hashnode down'));

    expect((await loadProjectMedia('decoder')).map((item) => item.id)).toEqual(['video:overview']);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Hashnode down') }),
      { context: 'load project media', level: 'warning' },
    );
  });

  it('never rejects, even when every source fails', async () => {
    loaders.loadVideos.mockRejectedValue(new Error('YouTube down'));
    loaders.loadProjects.mockRejectedValue(new Error('Sanity down'));
    loadFeedPosts.mockRejectedValue(new Error('Hashnode down'));

    await expect(loadProjectMedia('decoder')).resolves.toEqual([]);
  });
});

describe('loadProjectMedia when a source is slow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // The loaders answer an expired list at once (refreshing it in the background), so a load is
  // slow here only on a cold server or after a write; even then the block must not lose a link.
  it('an expired cache with a slow reload still lists the video and the post, at the deadline, with no report', async () => {
    allSlow();
    loaders.peekVideos.mockReturnValue(cached(VIDEOS));
    loaders.peekProjects.mockReturnValue(cached(PROJECTS));
    peekFeedPosts.mockReturnValue(cached([POST]));

    const { answer, tookMs } = await atDeadline(loadProjectMedia('decoder'));

    expect(answer.map((item) => item.id)).toEqual([POST_ID, 'video:overview']);
    expect(tookMs).toBeLessThanOrEqual(PROJECT_MEDIA_DEADLINE_MS);
    expect(reportApiFailure).not.toHaveBeenCalled();
  });

  it('lists the same items whether the videos reload is slow or answers in time', async () => {
    const fresh = (await loadProjectMedia('decoder')).map((item) => item.id);
    loaders.loadVideos.mockReturnValue(never());
    loaders.peekVideos.mockReturnValue(cached(VIDEOS));

    const { answer } = await atDeadline(loadProjectMedia('decoder'));

    expect(answer.map((item) => item.id)).toEqual(fresh);
  });

  it('a reload that answers inside the deadline wins over the cached list', async () => {
    loaders.peekVideos.mockReturnValue(cached([]));
    peekFeedPosts.mockReturnValue(cached([]));

    const { answer, tookMs } = await atDeadline(loadProjectMedia('decoder'));

    expect(answer.map((item) => item.id)).toEqual([POST_ID, 'video:overview']);
    expect(tookMs).toBe(0);
  });

  it('a cold start with a slow source answers within the deadline with what is known, without a report', async () => {
    loaders.loadVideos.mockReturnValue(never());

    const { answer, tookMs } = await atDeadline(loadProjectMedia('decoder'));

    expect(answer.map((item) => item.id)).toEqual([POST_ID]);
    expect(tookMs).toBeLessThanOrEqual(PROJECT_MEDIA_DEADLINE_MS);
    expect(reportApiFailure).not.toHaveBeenCalled();
  });

  it('a cold start with every source slow answers nothing at the deadline', async () => {
    allSlow();

    const { answer, tookMs } = await atDeadline(loadProjectMedia('decoder'));

    expect(answer).toEqual([]);
    expect(tookMs).toBeLessThanOrEqual(PROJECT_MEDIA_DEADLINE_MS);
  });

  it('keeps a source still loading at the deadline alive past the response, to fill its cache', async () => {
    loaders.loadVideos.mockReturnValue(never());

    await atDeadline(loadProjectMedia('decoder'));

    expect(after).toHaveBeenCalledTimes(1);
    expect(after.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });

  it('hands nothing over when every source answered in time', async () => {
    await loadProjectMedia('decoder');

    expect(after).not.toHaveBeenCalled();
  });
});

describe('loadProjectMedia never fails the project page', () => {
  it('a source that fails keeps the items of its last cached list, and is reported', async () => {
    loaders.loadVideos.mockRejectedValue(new Error('YouTube down'));
    loaders.peekVideos.mockReturnValue(cached(VIDEOS));

    expect((await loadProjectMedia('decoder')).map((item) => item.id)).toEqual([
      POST_ID,
      'video:overview',
    ]);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
  });

  it('a source that throws at once never rejects', async () => {
    loaders.loadVideos.mockImplementation(() => {
      throw new Error('videos loader broke');
    });

    await expect(loadProjectMedia('decoder')).resolves.toEqual([
      expect.objectContaining({ id: POST_ID }),
    ]);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
  });

  it('a cached list that cannot be read never rejects', async () => {
    loaders.loadVideos.mockRejectedValue(new Error('YouTube down'));
    loaders.peekVideos.mockImplementation(() => {
      throw new Error('the cached videos cannot be decoded');
    });

    await expect(loadProjectMedia('decoder')).resolves.toEqual([
      expect.objectContaining({ id: POST_ID }),
    ]);
  });

  it('a rule that throws while relating never rejects: nothing is listed, and it is reported', async () => {
    map.broken = true;

    await expect(loadProjectMedia('decoder')).resolves.toEqual([]);
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('the map cannot be read') }),
      { context: 'load project media', level: 'warning' },
    );
  });
});
