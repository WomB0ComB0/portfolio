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
 * @file What the /media view tests share (media-feed-qa.test.tsx and
 * media-feed-qa-see-also.test.tsx): four uploads (one made video and the three uploads of one
 * stream), a post to pair with, and the view rendered over them. Not a test file.
 */

import { render } from '@testing-library/react';
import { makeVideo } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MediaFeedView } from '@/app/(routes)/(dev)/media/_interface/media-feed/media-feed';
import { buildFeed, type FeedEntry } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import type {
  LayoutMode,
  PartsMode,
  PlayMode,
} from '@/app/(routes)/(dev)/media/_lib/media-options';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

export const ENTRIES: readonly FeedEntry[] = buildFeed(
  {
    videos: [
      makeVideo({
        _id: 'resq',
        title: 'Company overview',
        videoId: 'resq0000001',
        publishedDate: '2026-05-05T01:33:15Z',
        duration: '11:34',
      }),
      makeVideo({
        _id: 'm3',
        title: 'Coding marathon.',
        videoId: 'mara0000003',
        publishedDate: '2025-12-30T05:03:52Z',
        duration: '8:32:20',
      }),
      makeVideo({
        _id: 'm2',
        title: 'Coding marathon. (Part 2/2)',
        videoId: 'mara0000002',
        publishedDate: '2025-12-29T09:00:00Z',
        duration: '2:04:43',
      }),
      makeVideo({
        _id: 'm1',
        title: 'Coding marathon. (Part 1/2)',
        videoId: 'mara0000001',
        publishedDate: '2025-12-29T08:00:00Z',
        duration: '11:55:01',
      }),
    ],
  },
  () => null,
);

export interface FeedOptions {
  readonly entries?: readonly FeedEntry[];
  readonly layout?: LayoutMode;
  readonly parts?: PartsMode;
  readonly play?: PlayMode;
}

/** The view over `entries` (the four uploads above by default), folded unless told otherwise. */
export function renderFeed(search = '', options: FeedOptions = {}): HTMLElement {
  const { entries = ENTRIES, layout = 'sections', parts = 'fold', play = 'link' } = options;
  const { container } = render(
    <NuqsTestingAdapter searchParams={search}>
      <MediaFeedView
        feed={{ entries, missing: [] }}
        layout={layout}
        parts={parts}
        play={play}
        path="/media"
      />
    </NuqsTestingAdapter>,
  );
  return container;
}

export const noImages = (): string | null => null;
export const POST_URL = 'https://blog.example.dev/company-overview';
export const post = (overrides: Partial<Blog> = {}): Blog => ({
  title: 'Company overview, written up',
  slug: 'company-overview',
  publishedAt: '2026-05-01T00:00:00.000Z',
  excerpt: 'The same tour, in words.',
  source: 'hashnode',
  url: POST_URL,
  ...overrides,
});
