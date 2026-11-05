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

import { type JSX, Suspense } from 'react';
import { MediaPanel, MediaPanelSkeleton } from '@/app/(routes)/(dev)/media/_components/media-panel';
import { MediaView } from '@/app/(routes)/(dev)/media/_interface/media/media';
import { MEDIA_SECTION_LABELS, parseMediaTab } from '@/app/(routes)/(dev)/media/_lib/media-tabs';
import { SectionBoundary } from '@/components/data/section-boundary';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Media',
  description:
    'Explore my blog posts, presentations, talks, videos, and articles on technology, software development, and more',
  path: '/media',
});

interface MediaPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /media, rendered on the server: the header and tab bar at once, and the active tab's panel
 * (only that tab's data is loaded) streamed in behind its skeleton. The Suspense and the section
 * boundary are keyed by the tab, so switching tabs shows the new panel's skeleton and clears an
 * earlier tab's error, while the header and the tab bar stay.
 */
export default async function MediaPage({ searchParams }: MediaPageProps): Promise<JSX.Element> {
  const active = parseMediaTab((await searchParams).tab);
  return (
    <MediaView
      active={active}
      panel={
        <Suspense key={active} fallback={<MediaPanelSkeleton tab={active} />}>
          <SectionBoundary label={MEDIA_SECTION_LABELS[active]}>
            <MediaPanel tab={active} />
          </SectionBoundary>
        </Suspense>
      }
    />
  );
}
