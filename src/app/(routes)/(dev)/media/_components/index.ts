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
 * @file The /media components. Every one is a server component except MediaTabs (a client
 * island), and MediaPanel loads data through a server-only module, so import from here only on
 * the server.
 */

export { ArticlesSection, type ArticlesSectionProps, ArticlesSkeleton } from './articles-section';
export { BlogSection, type BlogSectionProps, BlogSkeleton } from './blog-section';
export { MediaPanel, type MediaPanelProps, MediaPanelSkeleton } from './media-panel';
export { MediaTabs, type MediaTabsProps } from './media-tabs';
export {
  PresentationsSection,
  type PresentationsSectionProps,
  PresentationsSkeleton,
} from './presentations-section';
export { TalksSection, type TalksSectionProps, TalksSkeleton } from './talks-section';
export { VideosSection, type VideosSectionProps, VideosSkeleton } from './videos-section';
