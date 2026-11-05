import 'server-only';
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
 * @file Server Sanity data, shared by /api/v1/sanity/* and the pages. Each collection has ONE
 * stale-on-error cache:
 * - Raw readers (`readProjects`, ...) answer what the getter returned, undecoded, through that
 *   cache. The API routes serve them as they are and map failures to HTTP (see serve.ts).
 * - Page loaders (`loadProjects`, ...) decode each document on its own (invalid ones are dropped
 *   and reported) and are React-cache()d per request.
 *
 * When Sanity fails after a good load, both get the last good answer and the loaders send a
 * warning. When it fails with nothing cached, the loaders reject with the getter's error and
 * report nothing themselves: Next reports page errors, and metadata reports its own fallback.
 */

import type { Schema } from 'effect';
import { cache } from 'react';
import { ensureBaseError } from '@/classes/error';
import {
  type Article,
  ArticleSchema,
  type Certification,
  CertificationSchema,
  type Experience,
  ExperienceSchema,
  type Place,
  PlaceSchema,
  type Presentation,
  PresentationSchema,
  type Project,
  ProjectSchema,
  type Resume,
  ResumeSchema,
  type Talk,
  TalkSchema,
  type YoutubeVideo,
  YoutubeVideoSchema,
} from '@/hooks/sanity/schemas';
import { createStaleCache, type StaleCacheResult } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import {
  getArticles,
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getPlaces,
  getPresentations,
  getProjects,
  getResume,
} from './api';
import { decodeEach, decodeOne, resetDecodeMemo } from './decode';
import { loadTalks as fetchTalks, type ListedVideo, loadYoutubeVideos } from './enrich';

export type {
  Article,
  Certification,
  Experience,
  Place,
  Presentation,
  Project,
  Resume,
  Talk,
  YoutubeVideo,
} from '@/hooks/sanity/schemas';
export type { ListedVideo } from './enrich';

/** How long an answer is served from memory before Sanity is asked again. Matches s-maxage. */
export const SANITY_CACHE_TTL_MS = 5 * 60_000;

/** What the getter last answered, fresh or stale. Rejects only when nothing is cached. */
export type SanityReader<T> = () => Promise<StaleCacheResult<T>>;

interface CachedReader<T> {
  readonly read: SanityReader<T>;
  readonly clear: () => void;
}

/**
 * A collection's cache and the reader in front of it. `key` is the API route's key. The clock is
 * read on every call, so a test's faked Date moves it too.
 */
function cachedReader<T>(key: string, load: () => Promise<T>): CachedReader<T> {
  const store = createStaleCache<T>({ ttlMs: SANITY_CACHE_TTL_MS, now: () => Date.now() });
  return { read: () => store.get(key, load), clear: () => store.clear() };
}

const readers = {
  projects: cachedReader('projects', getProjects),
  featuredProjects: cachedReader('featured-projects', getFeaturedProjects),
  experiences: cachedReader('experiences', getExperiences),
  certifications: cachedReader('certifications', getCertifications),
  places: cachedReader('places', getPlaces),
  resume: cachedReader('resume', getResume),
  presentations: cachedReader('presentations', getPresentations),
  articles: cachedReader('articles', getArticles),
  talks: cachedReader('talks', fetchTalks),
  videos: cachedReader('videos', loadYoutubeVideos),
} as const;

export const readProjects: SanityReader<Project[]> = readers.projects.read;
export const readFeaturedProjects: SanityReader<Project[]> = readers.featuredProjects.read;
export const readExperiences: SanityReader<Experience[]> = readers.experiences.read;
export const readCertifications: SanityReader<Certification[]> = readers.certifications.read;
export const readPlaces: SanityReader<Place[]> = readers.places.read;
/** `data` is null when no resume is active. */
export const readResume: SanityReader<Resume | null> = readers.resume.read;
export const readPresentations: SanityReader<Presentation[]> = readers.presentations.read;
export const readArticles: SanityReader<Article[]> = readers.articles.read;
/** Talks with YouTube durations where a key is set. */
export const readTalks: SanityReader<Talk[]> = readers.talks.read;
/** Sanity's videos plus the channel's uploads, each tagged with its `source` when a key is set. */
export const readVideos: SanityReader<YoutubeVideo[]> = readers.videos.read;

/** Forgets every collection's answer and every decoded result. Tests only. */
export function resetSanityLoaderCaches(): void {
  for (const reader of Object.values(readers)) reader.clear();
  resetDecodeMemo();
}

/** Sanity failed but the last good answer is served: the page still works, so a warning. */
function reportStale(key: string, error: unknown): void {
  reportApiFailure(ensureBaseError(error, `sanity:${key}`), {
    context: `load ${key} for pages`,
    level: 'warning',
  });
}

/** The answer's data, after reporting that it is stale if it is. */
async function readData<T>(read: SanityReader<T>, key: string): Promise<T> {
  const result = await read();
  if (result.stale) reportStale(key, result.error);
  return result.data;
}

/** `key`'s list, each document decoded with `schema`; invalid documents are dropped. */
async function loadList<A, I>(
  read: SanityReader<readonly unknown[]>,
  schema: Schema.Schema<A, I, never>,
  key: string,
): Promise<readonly A[]> {
  return decodeEach(schema, await readData(read, key), key);
}

export const loadProjects = cache(
  (): Promise<readonly Project[]> => loadList(readProjects, ProjectSchema, 'projects'),
);
export const loadFeaturedProjects = cache(
  (): Promise<readonly Project[]> =>
    loadList(readFeaturedProjects, ProjectSchema, 'featured-projects'),
);
export const loadExperiences = cache(
  (): Promise<readonly Experience[]> => loadList(readExperiences, ExperienceSchema, 'experiences'),
);
export const loadCertifications = cache(
  (): Promise<readonly Certification[]> =>
    loadList(readCertifications, CertificationSchema, 'certifications'),
);
export const loadPlaces = cache(
  (): Promise<readonly Place[]> => loadList(readPlaces, PlaceSchema, 'places'),
);
export const loadPresentations = cache(
  (): Promise<readonly Presentation[]> =>
    loadList(readPresentations, PresentationSchema, 'presentations'),
);
export const loadArticles = cache(
  (): Promise<readonly Article[]> => loadList(readArticles, ArticleSchema, 'articles'),
);
export const loadTalks = cache(
  (): Promise<readonly Talk[]> => loadList(readTalks, TalkSchema, 'talks'),
);

/** The active resume, or null when none is active (or it is invalid, which is reported). */
export const loadResume = cache(
  async (): Promise<Resume | null> =>
    decodeOne(ResumeSchema, await readData(readResume, 'resume'), 'resume'),
);

const isYoutubeApiVideo = (doc: unknown): boolean =>
  typeof doc === 'object' && doc !== null && (doc as { source?: unknown }).source === 'youtube-api';

/**
 * Decoding drops `source`, so it is read back from the raw documents by `_id`. Without a YouTube
 * key the list is Sanity's alone and carries no `source`, so a missing one means 'sanity'.
 */
function withSources(
  videos: readonly YoutubeVideo[],
  raw: readonly YoutubeVideo[],
): readonly ListedVideo[] {
  const fromChannel = new Set(raw.filter(isYoutubeApiVideo).map((doc) => doc._id));
  return videos.map((video) => ({
    ...video,
    source: fromChannel.has(video._id) ? 'youtube-api' : 'sanity',
  }));
}

/** Sanity's videos and the channel's uploads, each tagged with where it came from. */
export const loadVideos = cache(async (): Promise<readonly ListedVideo[]> => {
  const raw = await readData(readVideos, 'videos');
  return withSources(decodeEach(YoutubeVideoSchema, raw, 'videos'), raw);
});

const SANITY_DOCUMENT_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** True for an id Sanity could have issued. Anything else is never sent to Sanity. */
export const isSanityDocumentId = (id: string): boolean => SANITY_DOCUMENT_ID.test(id);

/**
 * The document with `id` from a list that is already cached for the index page. A by-id query
 * would need an unbounded per-id cache and would let random ids reach Sanity.
 */
async function findById<D extends { readonly _id: string }>(
  load: () => Promise<readonly D[]>,
  id: string,
): Promise<D | null> {
  if (!isSanityDocumentId(id)) return null;
  return (await load()).find((doc) => doc._id === id) ?? null;
}

export const loadProjectById = cache(
  (id: string): Promise<Project | null> => findById(loadProjects, id),
);
export const loadExperienceById = cache(
  (id: string): Promise<Experience | null> => findById(loadExperiences, id),
);
export const loadPlaceById = cache((id: string): Promise<Place | null> => findById(loadPlaces, id));
