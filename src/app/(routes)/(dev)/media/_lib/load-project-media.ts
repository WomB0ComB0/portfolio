import 'server-only';
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
 * @file The media about one project, for the project's own page (/projects/<id>): the videos,
 * stream uploads and posts whose row on /media says "Project: <this one>", newest first. It uses
 * the same rules and the same hand-written map as /media (media-projects.ts), so the two pages
 * always agree, and never a proposal.
 *
 * A project page is about the project, so this may hold it up for PROJECT_MEDIA_DEADLINE_MS at
 * most, never brings it down, and its list must not change from one answer to the next:
 * - the videos and the posts come from the caches /media fills (5 and 30 minutes). Once a list
 *   was loaded it answers at once, however old: past its TTL the loaders answer the cached list
 *   and refresh it in the background (loaders.ts, load-media.ts). The projects are the page's own
 *   list (loadProjects, React-cached for the request), so they cost nothing more here;
 * - a source still loading (a server that never loaded it, or a reload after a write) gets
 *   PROJECT_MEDIA_DEADLINE_MS and no more, then answers its last cached list, or none on a cold
 *   server. Its load carries on, kept alive past the response (after()), and fills the cache
 *   for the next request. That is not reported: the load reports its own failure;
 * - a source that fails is reported as a warning and answers its last cached list too, or none.
 *   Whatever else goes wrong here is reported and lists nothing. This never rejects.
 */

import { cache } from 'react';
import { ensureBaseError } from '@/classes/error';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { keepAlive } from '@/lib/cache/keep-alive';
import type { CachedValue } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import { loadProjects, loadVideos, peekProjects, peekVideos } from '@/lib/sanity/loaders';
import { loadFeedPosts, peekFeedPosts } from './load-media';
import { buildFeed, type FeedKind } from './media-feed';
import { MEDIA_PROJECT_RULES } from './media-project-links';
import { projectRefs, projectSignals, relateProjects } from './media-projects';

/** The longest a project page waits on any one media source. */
export const PROJECT_MEDIA_DEADLINE_MS = 1_500;
/** The most items a project page lists. */
export const PROJECT_MEDIA_MAX = 6;

/** One item about the project, as the project's page links it. */
export interface ProjectMediaItem {
  readonly id: string;
  readonly kind: FeedKind;
  readonly title: string;
  /** Where the item lives: YouTube, or the post. */
  readonly href: string;
}

/** One list the block is built from: how it loads, and how its cache is read without loading. */
interface Source<T> {
  readonly name: string;
  /** The list through its cache: at once while fresh, after the reload once it ran out. */
  readonly load: () => Promise<readonly T[]>;
  /** The list last cached, however old; undefined when it was never loaded. Never waits. */
  readonly peek: () => CachedValue<readonly T[]> | undefined;
}

/** A warning: the project page still answers, without what failed. */
function report(what: string, error: unknown): void {
  reportApiFailure(ensureBaseError(error, `project-media:${what}`), {
    context: 'load project media',
    level: 'warning',
  });
}

/** The source's last cached list; none when it was never loaded, or (reported) cannot be read. */
function lastCached<T>({ name, peek }: Source<T>): readonly T[] {
  try {
    return peek()?.data ?? [];
  } catch (error: unknown) {
    report(name, error);
    return [];
  }
}

/**
 * The source's list within the deadline. When that runs out, or the load fails (reported), its
 * last cached list instead, so a link the block had is still there; none on a cold server. A
 * load still running at the deadline is kept alive past the response, so it fills the cache.
 */
async function soft<T>(source: Source<T>): Promise<readonly T[]> {
  let loading: Promise<readonly T[]> | undefined;
  try {
    loading = source.load();
    return await withDeadline(loading, PROJECT_MEDIA_DEADLINE_MS, `project media ${source.name}`);
  } catch (error: unknown) {
    if (!(error instanceof DeadlineError)) report(source.name, error);
    else if (loading) keepAlive(loading);
    return lastCached(source);
  }
}

/** The stills are not shown on a project page, so no image is built. */
const noStill = (): null => null;

/** The items about `projectId` among everything the sources hold, newest first, capped. */
async function relatedTo(projectId: string): Promise<readonly ProjectMediaItem[]> {
  const [videos, posts, projects] = await Promise.all([
    soft({ name: 'videos', load: loadVideos, peek: peekVideos }),
    soft({ name: 'posts', load: loadFeedPosts, peek: peekFeedPosts }),
    soft({ name: 'projects', load: loadProjects, peek: peekProjects }),
  ]);
  const sources = { videos, posts };
  const entries = relateProjects(
    buildFeed(sources, noStill),
    projectSignals(sources),
    projectRefs(projects),
    MEDIA_PROJECT_RULES,
  );
  return entries
    .flatMap(({ id, kind, title, href, project }) =>
      project?.id === projectId && href !== null ? [{ id, kind, title, href }] : [],
    )
    .slice(0, PROJECT_MEDIA_MAX);
}

/**
 * The media about the project with `projectId`, newest first, PROJECT_MEDIA_MAX at most; none
 * when nothing is related, on a cold server whose sources could not answer in time, or (reported)
 * when relating them fails. Never rejects. React-cached per request.
 */
export const loadProjectMedia = cache(
  async (projectId: string): Promise<readonly ProjectMediaItem[]> => {
    try {
      return await relatedTo(projectId);
    } catch (error: unknown) {
      report('relate', error);
      return [];
    }
  },
);
