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
 * @file One /media tab's panel, rendered on the server: only the active tab's data is loaded.
 */

import type { JSX } from 'react';
import {
  loadArticles,
  loadBlogPosts,
  loadPresentations,
  loadTalks,
  loadVideos,
} from '@/app/(routes)/(dev)/media/_lib/load-media';
import type { MediaTab } from '@/app/(routes)/(dev)/media/_lib/media-tabs';
import { ArticlesSection, ArticlesSkeleton } from './articles-section';
import { BlogSection, BlogSkeleton } from './blog-section';
import { PresentationsSection, PresentationsSkeleton } from './presentations-section';
import { TalksSection, TalksSkeleton } from './talks-section';
import { VideosSection, VideosSkeleton } from './videos-section';

export interface MediaPanelProps {
  readonly tab: MediaTab;
}

/**
 * Loads `tab`'s list and renders its section. A load that fails with nothing cached rejects, so
 * the section boundary around the panel shows the error while the header and tabs stay.
 */
export async function MediaPanel({ tab }: MediaPanelProps): Promise<JSX.Element> {
  switch (tab) {
    case 'blog':
      return <BlogSection items={await loadBlogPosts()} />;
    case 'presentations':
      return <PresentationsSection items={await loadPresentations()} />;
    case 'talks':
      return <TalksSection items={await loadTalks()} />;
    case 'videos':
      return <VideosSection items={await loadVideos()} />;
    case 'articles':
      return <ArticlesSection items={await loadArticles()} />;
  }
}

const PANEL_SKELETONS: Readonly<Record<MediaTab, () => JSX.Element>> = {
  blog: BlogSkeleton,
  presentations: PresentationsSkeleton,
  talks: TalksSkeleton,
  videos: VideosSkeleton,
  articles: ArticlesSkeleton,
};

/** `tab`'s panel while its list loads: the section's own card grid, in skeleton form. */
export function MediaPanelSkeleton({ tab }: MediaPanelProps): JSX.Element {
  const Skeleton = PANEL_SKELETONS[tab];
  return <Skeleton />;
}
