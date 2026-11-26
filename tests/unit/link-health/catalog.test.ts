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

import {
  makeArticle,
  makeBook,
  makeBookshelf,
  makeCertification,
  makeExperience,
  makePresentation,
  makeProject,
  makeTalk,
  makeVideo,
} from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFeed, type FeedEntry } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import type { LinkHealthScope } from '@/lib/link-health/types';
import { normalizeLinkUrl } from '@/lib/link-health/url';

vi.mock('server-only', () => ({}));
const sources = vi.hoisted(() => ({
  projects: vi.fn(),
  certifications: vi.fn(),
  experiences: vi.fn(),
  media: vi.fn(),
  books: vi.fn(),
  bookshelves: vi.fn(),
}));
const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));
vi.mock('@/lib/sanity/loaders', () => ({
  loadProjects: sources.projects,
  loadCertifications: sources.certifications,
  loadExperiences: sources.experiences,
  loadBooks: sources.books,
  loadBookshelves: sources.bookshelves,
}));
vi.mock('@/app/(routes)/(dev)/media/_lib/load-feed', () => ({ loadMediaFeed: sources.media }));
// The bookshelf catalog draws each cover with the real image URL builder; the client module itself
// reads server configuration on import.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  ...report,
}));

import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { loadLinkCatalog, resetLinkCatalogCache } from '@/lib/link-health/catalog';

const media = (entries: readonly FeedEntry[]) => ({
  entries,
  missing: [],
  proposals: [],
  videosComplete: true,
});
beforeEach(() => {
  resetLinkCatalogCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T18:00:00Z'));
  for (const source of Object.values(sources)) source.mockReset().mockResolvedValue([]);
  sources.media.mockResolvedValue(media([]));
  report.reportApiFailure.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('published link catalog', () => {
  it('selects only rendered project Live and Code URLs, in page order', async () => {
    sources.projects.mockResolvedValue([
      makeProject({
        _id: 'older',
        order: 1,
        startDate: '2023-01-01',
        liveUrl: 'https://older.example.com',
        githubUrl: 'javascript:alert(1)',
      }),
      makeProject({
        _id: 'featured',
        order: 2,
        featured: true,
        liveUrl: ' https://demo.example.com/#screen ',
        githubUrl: 'https://github.com/example/repo',
        description: 'Plain text https://ignored.example.com',
        image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-cover-100x100-png' } },
      }),
      makeProject({ _id: 'invalid', order: 3, liveUrl: 'https:invalid.example.com' }),
    ]);
    expect(await loadLinkCatalog('projects')).toEqual([
      'https://demo.example.com/',
      'https://github.com/example/repo',
      'https://older.example.com/',
    ]);
    expect(sources.media).not.toHaveBeenCalled();
    expect(sources.certifications).not.toHaveBeenCalled();
    expect(sources.experiences).not.toHaveBeenCalled();
  });

  it('normalizes and deduplicates before applying the 500 URL bound', async () => {
    const duplicates = Array.from({ length: 200 }, (_, i) =>
      makeProject({ order: i, liveUrl: `https://demo.example.com/#${i}` }),
    );
    const distinct = Array.from({ length: 520 }, (_, i) =>
      makeProject({ order: i + 200, liveUrl: `https://demo.example.com/${i}` }),
    );
    sources.projects.mockResolvedValue([...duplicates, ...distinct]);
    const result = await loadLinkCatalog('projects');
    expect(result).toHaveLength(500);
    expect(new Set(result).size).toBe(500);
    expect(result[0]).toBe('https://demo.example.com/');
    expect(result.at(-1)).toBe('https://demo.example.com/498');
  });

  it('keeps selected credential files as well as issuer verification pages', async () => {
    sources.certifications.mockResolvedValue([
      makeCertification({ credentialUrl: 'https://credly.com/badges/abc#details', featured: true }),
      makeCertification({
        credentialUrl: 'https://cdn.sanity.io/files/project/production/certificate.pdf',
      }),
      makeCertification({ credentialUrl: 'https://storage.googleapis.com/credentials/cert.pdf' }),
      makeCertification({ credentialUrl: 'mailto:person@example.com' }),
    ]);
    expect(await loadLinkCatalog('certifications')).toEqual(
      expect.arrayContaining([
        'https://credly.com/badges/abc',
        'https://cdn.sanity.io/files/project/production/certificate.pdf',
        'https://storage.googleapis.com/credentials/cert.pdf',
      ]),
    );
    expect(await loadLinkCatalog('certifications')).toHaveLength(3);
  });

  it('uses Media render precedence rather than unused talk/slides alternatives or thumbnail URLs', async () => {
    const entries = buildFeed(
      {
        posts: [
          {
            title: 'Post',
            slug: 'a-post',
            source: 'devto',
            publishedAt: '2025-01-01',
            excerpt: '',
            imageUrl: 'https://image.example.com/post.png',
          },
        ],
        talks: [
          makeTalk({
            videoUrl: 'https://www.youtube.com/watch?v=talkVideo01',
            slidesPdfUrl: 'https://hidden.example.com/talk.pdf',
            slidesUrl: 'https://hidden.example.com/talk',
          }),
        ],
        presentations: [
          makePresentation({
            slidesUrl: 'https://slides.example.com/deck',
            slidesPdfUrl: 'https://hidden.example.com/deck.pdf',
            videoUrl: 'https://hidden.example.com/video',
            eventUrl: 'https://hidden.example.com/event',
          }),
          makePresentation({ slidesPdfUrl: 'https://cdn.sanity.io/files/p/d/deck.pdf' }),
        ],
        articles: [makeArticle({ publicationUrl: 'https://journal.example.com/article' })],
        videos: [makeVideo({ videoId: 'standalone1' })],
      },
      () => 'https://cdn.sanity.io/images/p/d/thumbnail.jpg',
    );
    sources.media.mockResolvedValue(media(entries));
    const result = await loadLinkCatalog('media');
    expect(result).toEqual(
      expect.arrayContaining([
        'https://dev.to/mikeodnis/a-post',
        'https://www.youtube.com/watch?v=talkVideo01',
        'https://slides.example.com/deck',
        'https://cdn.sanity.io/files/p/d/deck.pdf',
        'https://journal.example.com/article',
      ]),
    );
    expect(result).toHaveLength(5);
  });

  it('includes written secondary links, while excluding standalone videos/streams and their video pairs', async () => {
    const rows = buildFeed({ videos: [makeVideo()] }, () => '').map((entry) => ({
      ...entry,
      pair: {
        id: 'post:written',
        kind: 'post' as const,
        title: 'Written',
        href: 'https://writing.example.com/secondary',
        videoId: null,
      },
    }));
    const written = buildFeed(
      { articles: [makeArticle({ publicationUrl: 'https://writing.example.com/post' })] },
      () => '',
    ).map((entry) => ({
      ...entry,
      pair: {
        id: 'video:other',
        kind: 'video' as const,
        title: 'Video',
        href: 'https://www.youtube.com/watch?v=otherVideo1',
        videoId: 'otherVideo1',
      },
    }));
    sources.media.mockResolvedValue(media([...rows, ...written]));
    expect(await loadLinkCatalog('media')).toEqual([
      'https://writing.example.com/secondary',
      'https://writing.example.com/post',
    ]);
  });

  it('uses listed Experience story/detail links, including more/duties, and excludes future roles', async () => {
    sources.experiences.mockResolvedValue([
      makeExperience({
        companyUrl: 'https://company.example.com',
        description:
          'Built the docs (https://docs.example.com/guide#intro). More at https://work.example.com/report.',
        responsibilities: ['Published https://papers.example.com/paper.'],
        technologies: ['https://ignored.example.com/technology'],
      }),
      makeExperience({
        startDate: '2099-01-01',
        endDate: null,
        current: true,
        companyUrl: 'https://future.example.com',
        description: 'See https://future.example.com/work.',
      }),
      makeExperience({ companyUrl: ' https://not-linked.example.com', description: 'Plain text.' }),
    ]);
    expect(await loadLinkCatalog('experience')).toEqual(
      expect.arrayContaining([
        'https://company.example.com/',
        'https://docs.example.com/guide',
        'https://work.example.com/report',
        'https://papers.example.com/paper',
      ]),
    );
    expect(await loadLinkCatalog('experience')).toHaveLength(4);
  });

  it('does not lose distinct Story links that the detail chip identity folds together', async () => {
    sources.experiences.mockResolvedValue([
      makeExperience({
        description: 'See http://work.example.com/proof and https://work.example.com/proof.',
      }),
    ]);
    expect(await loadLinkCatalog('experience')).toEqual(
      expect.arrayContaining(['http://work.example.com/proof', 'https://work.example.com/proof']),
    );
  });

  it('includes rendered sub-role destinations without checking future or invalid sub-roles', async () => {
    sources.experiences.mockResolvedValue([
      makeExperience({
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        current: false,
        companyUrl: null,
        description: '',
        responsibilities: [],
        subRoles: [
          {
            _key: 'published',
            position: 'Engineer',
            startDate: '2025-01-01',
            endDate: '2025-03-31',
            current: false,
            description: 'Project evidence (https://work.example.com/child#details).',
            responsibilities: ['See https://work.example.com/proof.'],
          },
          {
            _key: 'future',
            position: 'Lead',
            startDate: '2027-01-01',
            current: true,
            description: 'https://hidden.example.com/future',
          },
          {
            _key: 'reversed',
            position: 'Other',
            startDate: '2025-06-01',
            endDate: '2025-01-01',
            current: false,
            description: 'https://hidden.example.com/invalid',
          },
        ],
      }),
    ]);
    expect(await loadLinkCatalog('experience')).toEqual([
      'https://work.example.com/child',
      'https://work.example.com/proof',
    ]);
  });

  it('excludes stable profiles, service roots and image assets without excluding content on those platforms', async () => {
    const excluded = [
      'https://github.com/example',
      'https://github.com/',
      'https://www.linkedin.com/in/person',
      'https://www.youtube.com/@creator',
      'https://open.spotify.com/artist/abc',
      'https://cdn.sanity.io/images/p/d/image.png',
    ];
    const included = [
      'https://github.com/example/repository',
      'https://www.linkedin.com/pulse/an-article',
      'https://www.youtube.com/watch?v=talkVideo01',
      'https://docs.google.com/presentation/d/deck/edit',
    ];
    sources.projects.mockResolvedValue(
      [...excluded, ...included].map((liveUrl) => makeProject({ liveUrl })),
    );
    expect(await loadLinkCatalog('projects')).toEqual(included);
  });

  it.each(['projects', 'media', 'certifications', 'experience'] as const)(
    'does not reinterpret an upstream failure as an empty %s catalog',
    async (scope) => {
      const source = sources[scope === 'experience' ? 'experiences' : scope];
      source.mockRejectedValue(new Error('source unavailable'));
      await expect(loadLinkCatalog(scope)).rejects.toThrow('source unavailable');
    },
  );

  it('selects the URL each rendered book links, in stage order, and no unrendered book', async () => {
    const firstShelf = makeBookshelf();
    const secondShelf = makeBookshelf();
    const shelves = [firstShelf, secondShelf];
    const books = [
      makeBook({ shelfId: secondShelf._id, url: 'https://later.example.com/book#contents' }),
      makeBook({ shelfId: firstShelf._id, url: ' https://first.example.com/book ' }),
      makeBook({ shelfId: firstShelf._id }),
      makeBook({ shelfId: firstShelf._id, url: null }),
      makeBook({ shelfId: firstShelf._id, url: '   ' }),
      makeBook({ shelfId: firstShelf._id, url: 'https://github.com/example' }),
      // On no published shelf: the bookshelf does not render it, so its link is not checked.
      makeBook({ shelfId: 'bookshelf-unpublished', url: 'https://orphan.example.com/book' }),
    ];
    sources.books.mockResolvedValue(books);
    sources.bookshelves.mockResolvedValue(shelves);

    const result = await loadLinkCatalog('bookshelf');

    expect(result).toEqual(['https://first.example.com/book', 'https://later.example.com/book']);
    // Exactly the links the detail view renders (BookItem.url), less stable profile pages.
    const rendered = buildBookshelfCatalog(books, shelves).books.flatMap((book) =>
      book.url ? [normalizeLinkUrl(book.url)] : [],
    );
    expect(result).toEqual(rendered.filter((href) => href !== 'https://github.com/example'));
    expect(report.reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { books: [books.at(-1)?.slug.current] } }),
      expect.objectContaining({ level: 'warning' }),
    );
    expect(sources.projects).not.toHaveBeenCalled();
    expect(sources.media).not.toHaveBeenCalled();
  });

  it('answers an empty bookshelf catalog when Sanity has no books', async () => {
    sources.bookshelves.mockResolvedValue([makeBookshelf()]);

    await expect(loadLinkCatalog('bookshelf')).resolves.toEqual([]);
  });

  it.each(['books', 'bookshelves'] as const)(
    'does not reinterpret a %s outage as an empty bookshelf catalog',
    async (source) => {
      sources[source].mockRejectedValue(new Error('Sanity answered 503'));

      await expect(loadLinkCatalog('bookshelf')).rejects.toThrow('Sanity answered 503');
    },
  );

  it('rejects unsupported scopes instead of loading Places or Spotify', async () => {
    await expect(loadLinkCatalog('places' as LinkHealthScope)).rejects.toThrow();
    for (const source of Object.values(sources)) expect(source).not.toHaveBeenCalled();
  });

  it('shares an in-flight load and caches one scope for one minute', async () => {
    let resolve!: (projects: ReturnType<typeof makeProject>[]) => void;
    sources.projects.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = Array.from({ length: 5 }, () => loadLinkCatalog('projects'));
    await vi.waitFor(() => expect(sources.projects).toHaveBeenCalledTimes(1));
    resolve([makeProject({ liveUrl: 'https://demo.example.com' })]);
    await expect(Promise.all(pending)).resolves.toEqual(
      Array.from({ length: 5 }, () => ['https://demo.example.com/']),
    );
    const first = await loadLinkCatalog('projects');
    first.push('https://not-authorized.example.com/');
    await expect(loadLinkCatalog('projects')).resolves.toEqual(['https://demo.example.com/']);
    expect(sources.projects).toHaveBeenCalledTimes(1);
    sources.projects.mockResolvedValue([makeProject({ liveUrl: 'https://new.example.com' })]);
    vi.setSystemTime(Date.now() + 60_001);
    await expect(loadLinkCatalog('projects')).resolves.toEqual(['https://new.example.com/']);
    expect(sources.projects).toHaveBeenCalledTimes(2);
  });

  it('refreshes an empty Media catalog after one minute', async () => {
    await expect(loadLinkCatalog('media')).resolves.toEqual([]);
    const entries = buildFeed(
      { articles: [makeArticle({ publicationUrl: 'https://writing.example.com/new' })] },
      () => '',
    );
    sources.media.mockResolvedValue(media(entries));
    await expect(loadLinkCatalog('media')).resolves.toEqual([]);
    vi.setSystemTime(Date.now() + 60_001);
    await expect(loadLinkCatalog('media')).resolves.toEqual(['https://writing.example.com/new']);
    expect(sources.media).toHaveBeenCalledTimes(2);
  });

  it('fails closed after an expired catalog cannot reload, rather than authorizing old URLs', async () => {
    sources.projects.mockResolvedValue([makeProject({ liveUrl: 'https://removed.example.com' })]);
    await loadLinkCatalog('projects');
    sources.projects.mockRejectedValue(new Error('catalog unavailable'));
    vi.setSystemTime(Date.now() + 60_001);
    await expect(loadLinkCatalog('projects')).rejects.toThrow('catalog unavailable');
  });
});
