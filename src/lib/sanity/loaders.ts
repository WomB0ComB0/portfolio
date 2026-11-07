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
 * stale-on-error cache per server process, so the routes and the pages make one Sanity request
 * per collection per TTL in each process (separate serverless instances each ask on their own):
 * - Raw readers (`readProjects`, ...) answer what the getter returned, undecoded, through that
 *   cache. The API routes serve them as they are and map failures to HTTP (see serve.ts).
 * - Page loaders (`loadProjects`, ...) decode each document on its own (invalid ones are dropped
 *   and reported) and are React-cache()d per request.
 * - Peeks (`peekProjects`, ...) answer the last list cached, decoded the same way, at once and
 *   however old, without asking Sanity: for a home tile whose deadline ran out mid-reload.
 *
 * When Sanity fails after a good load, both get the last good answer and the loaders send a
 * warning. When it fails with nothing cached, the loaders reject with the getter's error and
 * report nothing themselves: Next reports page errors, and metadata reports its own fallback.
 * A missing document is only believed fresh: like the API's 503, `loadResume` rejects when the
 * "no active resume" it would serve is stale.
 *
 * The site settings singleton has no API route and is read by the pages only. Its fields are
 * decoded one by one: an invalid field is dropped (and reported), the others are kept. A blank
 * location is the owner clearing it: absent, and not reported.
 */

import { Either, Option, ParseResult, Schema } from 'effect';
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
  type SiteSettings,
  SiteSettingsDocumentSchema,
  type Talk,
  TalkSchema,
  type YoutubeVideo,
  YoutubeVideoSchema,
} from '@/hooks/sanity/schemas';
import { withDeadline } from '@/lib/async/deadline';
import {
  type CachedValue,
  createStaleCache,
  type StaleCache,
  type StaleCacheResult,
} from '@/lib/cache/stale-cache';
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
  getSiteSettings,
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
  SiteSettings,
  Talk,
  YoutubeVideo,
} from '@/hooks/sanity/schemas';
export type { ListedVideo } from './enrich';

/** How long an answer is served from memory before Sanity is asked again. Matches s-maxage. */
export const SANITY_CACHE_TTL_MS = 5 * 60_000;

/** What the getter last answered, fresh or stale. Rejects only when nothing is cached. */
export type SanityReader<T> = () => Promise<StaleCacheResult<T>>;

/**
 * Next's bundler loads this module once for route handlers and once for pages, even in one Node
 * process, so module state would give each its own cache. The readers' cache lives on globalThis
 * under this registry key instead, and every copy of the module finds the same one.
 */
const SHARED_READERS_KEY = Symbol.for('portfolio.sanity.readers');

type ProcessGlobal = typeof globalThis & { [SHARED_READERS_KEY]?: StaleCache<unknown> };

/**
 * The process's cache, created by whichever copy of the module loads first. It holds every
 * collection under its API route key; each key is read by one reader below, so its data always
 * has that reader's type. The clock is read on every call, so a test's faked Date moves it too.
 */
function processCache(): StaleCache<unknown> {
  const processGlobal = globalThis as ProcessGlobal;
  processGlobal[SHARED_READERS_KEY] ??= createStaleCache<unknown>({
    ttlMs: SANITY_CACHE_TTL_MS,
    now: () => Date.now(),
  });
  return processGlobal[SHARED_READERS_KEY];
}

const sharedCache = processCache();

/**
 * The reader for collection `key`. `load` is this copy's getter: it runs only when the shared
 * cache has no fresh answer and no other copy is already loading `key`.
 */
const cachedReader =
  <T>(key: string, load: () => Promise<T>): SanityReader<T> =>
  () =>
    sharedCache.get(key, load) as Promise<StaleCacheResult<T>>;

export const readProjects = cachedReader<Project[]>('projects', getProjects);
export const readFeaturedProjects = cachedReader<Project[]>(
  'featured-projects',
  getFeaturedProjects,
);
export const readExperiences = cachedReader<Experience[]>('experiences', getExperiences);
export const readCertifications = cachedReader<Certification[]>(
  'certifications',
  getCertifications,
);
export const readPlaces = cachedReader<Place[]>('places', getPlaces);
/** `data` is null when no resume is active. */
export const readResume = cachedReader<Resume | null>('resume', getResume);
export const readPresentations = cachedReader<Presentation[]>('presentations', getPresentations);
export const readArticles = cachedReader<Article[]>('articles', getArticles);
/**
 * The longest a talks or videos load may run. Both wait on YouTube, whose retries can take 30 s
 * or more, and the browser gives up on the route after 10 s; like the other routes'
 * UPSTREAM_DEADLINE_MS, this leaves time to answer. Past it the load rejects, so the cache
 * serves the last good answer, or with nothing cached the route answers 503 and a page rejects.
 * The YouTube requests are not cancelled, and their late answer is not cached.
 */
export const YOUTUBE_LOAD_DEADLINE_MS = 8_000;

/** `load`, rejecting with a DeadlineError once {@link YOUTUBE_LOAD_DEADLINE_MS} passes. */
const withinYoutubeDeadline =
  <T>(key: string, load: () => Promise<T>): (() => Promise<T>) =>
  () =>
    withDeadline(load(), YOUTUBE_LOAD_DEADLINE_MS, `sanity ${key} with YouTube data`);

/** Talks with YouTube durations where a key is set. */
export const readTalks = cachedReader<Talk[]>('talks', withinYoutubeDeadline('talks', fetchTalks));
/** Sanity's videos plus the channel's uploads, each tagged with its `source` when a key is set. */
export const readVideos = cachedReader<YoutubeVideo[]>(
  'videos',
  withinYoutubeDeadline('videos', loadYoutubeVideos),
);

/**
 * Forgets every collection's answer, for every copy of this module in the process, and this
 * copy's decoded results. Tests only.
 */
export function resetSanityLoaderCaches(): void {
  sharedCache.clear();
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
function dataOf<T>(result: StaleCacheResult<T>, key: string): T {
  if (result.stale) reportStale(key, result.error);
  return result.data;
}

async function readData<T>(read: SanityReader<T>, key: string): Promise<T> {
  return dataOf(await read(), key);
}

/** `key`'s list, each document decoded with `schema`; invalid documents are dropped. */
async function loadList<A, I>(
  read: SanityReader<readonly unknown[]>,
  schema: Schema.Schema<A, I, never>,
  key: string,
): Promise<readonly A[]> {
  return decodeEach(schema, await readData(read, key), key);
}

/**
 * `key`'s last list in the shared cache, decoded like {@link loadList}'s, and when it was loaded
 * (epoch ms), however old; undefined when Sanity never answered it in this process. Never asks
 * Sanity, never waits and reports no staleness (an invalid document is still reported, once per
 * answer, by decodeEach).
 */
function peekList<A, I>(
  schema: Schema.Schema<A, I, never>,
  key: string,
): CachedValue<readonly A[]> | undefined {
  const cached = sharedCache.peek(key);
  if (!cached || !Array.isArray(cached.data)) return undefined;
  return { data: decodeEach(schema, cached.data, key), loadedAt: cached.loadedAt };
}

export const peekProjects = (): CachedValue<readonly Project[]> | undefined =>
  peekList(ProjectSchema, 'projects');
export const peekExperiences = (): CachedValue<readonly Experience[]> | undefined =>
  peekList(ExperienceSchema, 'experiences');
export const peekCertifications = (): CachedValue<readonly Certification[]> | undefined =>
  peekList(CertificationSchema, 'certifications');
export const peekPlaces = (): CachedValue<readonly Place[]> | undefined =>
  peekList(PlaceSchema, 'places');

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

/**
 * The active resume, or null when Sanity's fresh answer is that none is active (or it is invalid,
 * which is reported). A stale null is an old "none" served only because Sanity just failed, so it says
 * nothing about the resume now: like the API's 503 (serve.ts), this rejects with that failure,
 * so a page reaches its error boundary instead of answering 404 during an outage.
 */
export const loadResume = cache(async (): Promise<Resume | null> => {
  const result = await readResume();
  if (result.stale && result.data == null) throw ensureBaseError(result.error, 'sanity:resume');
  return decodeOne(ResumeSchema, dataOf(result, 'resume'), 'resume');
});

const SITE_SETTINGS_KEY = 'site-settings';

const readSiteSettings = cachedReader<unknown>(SITE_SETTINGS_KEY, getSiteSettings);

const decodeSettings = Schema.decodeUnknownEither(SiteSettingsDocumentSchema);

/** The top-level fields an invalid document gets wrong (the schema lists every one). */
function invalidFields(doc: object): ReadonlySet<PropertyKey> {
  const result = decodeSettings(doc);
  if (Either.isRight(result)) return new Set();
  const issues = ParseResult.ArrayFormatter.formatErrorSync(result.left);
  return new Set(issues.flatMap(({ path }) => path.slice(0, 1)));
}

/**
 * `doc` as site settings. Each field that breaks its rule is left out, so the page falls back for
 * that field alone (for the location, which has no built-in value, to none); the document is
 * reported once per answer, naming every bad field. Null when there is no document, or what is
 * left is still not one (no _id, another _type).
 */
function decodeSiteSettings(doc: unknown): SiteSettings | null {
  const settings = decodeOne(SiteSettingsDocumentSchema, doc, SITE_SETTINGS_KEY);
  if (settings !== null || typeof doc !== 'object' || doc === null) return settings;
  const invalid = invalidFields(doc);
  const validFields = Object.fromEntries(Object.entries(doc).filter(([key]) => !invalid.has(key)));
  return Option.getOrNull(Either.getRight(decodeSettings(validFields)));
}

/**
 * The site settings, each invalid field left out; null when the document does not exist yet.
 * When Sanity fails after a good load, the last good settings and a warning (the latest answer,
 * so a field the owner cleared stays cleared); with nothing cached, rejects with the getter's
 * error.
 */
export const loadSiteSettings = cache(
  async (): Promise<SiteSettings | null> =>
    decodeSiteSettings(await readData(readSiteSettings, SITE_SETTINGS_KEY)),
);

/**
 * The settings last cached, decoded like {@link loadSiteSettings}'s, and when they were loaded,
 * however old; undefined when Sanity never answered in this process. Never asks Sanity or waits.
 */
export function peekSiteSettings(): CachedValue<SiteSettings | null> | undefined {
  const cached = sharedCache.peek(SITE_SETTINGS_KEY);
  if (!cached) return undefined;
  return { data: decodeSiteSettings(cached.data), loadedAt: cached.loadedAt };
}

/**
 * The location the site settings give right now, for page metadata, which must neither wait on
 * Sanity nor name a place the owner cleared. Only settings loaded less than SANITY_CACHE_TTL_MS
 * ago count: what {@link loadSiteSettings} would answer without asking Sanity again. Null when
 * they give no location, when this server has not loaded them yet, and when the last load is
 * older (a reload is due, or Sanity is failing and the pages show the last good settings). Never
 * asks Sanity or waits.
 */
export function peekSiteLocation(): string | null {
  const cached = peekSiteSettings();
  if (!cached || Date.now() - cached.loadedAt >= SANITY_CACHE_TTL_MS) return null;
  return cached.data?.location?.trim() || null;
}

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
