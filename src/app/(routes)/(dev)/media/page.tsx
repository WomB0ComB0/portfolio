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

import { permanentRedirect } from 'next/navigation';
import type { JSX } from 'react';
import {
  MEDIA_TITLE,
  MediaFeedView,
} from '@/app/(routes)/(dev)/media/_interface/media-feed/media-feed';
import { loadMediaFeed } from '@/app/(routes)/(dev)/media/_lib/load-feed';
import { legacyTabHref, MEDIA_PATH } from '@/app/(routes)/(dev)/media/_lib/media-filters';
import {
  DEFAULT_LAYOUT,
  DEFAULT_PARTS,
  DEFAULT_PLAY,
} from '@/app/(routes)/(dev)/media/_lib/media-options';
import { JsonLd } from '@/components/scripts/structured-data';
import { collectionPageJsonLd } from '@/lib/seo/json-ld';
import { constructMetadata } from '@/utils';

/**
 * The description names what the page's sections hold today (Writing, Video, Streams). A kind
 * with nothing published (talks, presentations, articles) is not promised to a search result.
 */
export const metadata = constructMetadata({
  title: 'Media',
  description: 'Writing, videos and streams on technology and software, newest first.',
  path: '/media',
});

interface MediaPageProps {
  /** ?kind, ?series and ?q: the page's filters, so a shared link renders filtered. */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /media in sections (Writing, Video, Streams: one list per kind that has items), rendered on
 * the server: every source is awaited first (each within its deadline, behind its stale cache),
 * so every row is in the first HTML with no loading.tsx. An old ?tab= link redirects (308) to
 * the ?kind= it now means. When every source fails, the load rejects and
 * src/app/(routes)/error.tsx shows the error inside the shell.
 *
 * Its JSON-LD is the page alone, a CollectionPage named as the h1 names it: the rows link to
 * pieces on other sites, so none gets a node of its own (src/lib/seo/json-ld.ts).
 */
export default async function MediaPage({ searchParams }: MediaPageProps): Promise<JSX.Element> {
  const legacy = legacyTabHref(await searchParams);
  if (legacy !== null) permanentRedirect(legacy);
  const feed = await loadMediaFeed();
  return (
    <>
      <JsonLd data={collectionPageJsonLd({ path: MEDIA_PATH, name: MEDIA_TITLE })} />
      <MediaFeedView
        feed={feed}
        layout={DEFAULT_LAYOUT}
        parts={DEFAULT_PARTS}
        play={DEFAULT_PLAY}
        path={MEDIA_PATH}
      />
    </>
  );
}
