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
 * @file The /media tabs, shared by the server page (which renders the active tab's panel) and
 * the client tab bar (which writes `?tab=`). No directive: both sides import it.
 */

/** Every tab, in tab-bar order. `?tab=` takes one of these. */
export const MEDIA_TABS = ['blog', 'presentations', 'talks', 'videos', 'articles'] as const;

export type MediaTab = (typeof MEDIA_TABS)[number];

/** The tab for `/media` with no (or an unusable) `?tab=`. */
export const DEFAULT_MEDIA_TAB: MediaTab = 'blog';

/** Each tab's name in the tab bar. */
export const MEDIA_TAB_LABELS: Readonly<Record<MediaTab, string>> = {
  blog: 'Blog',
  presentations: 'Presentations',
  talks: 'Talks',
  videos: 'Videos',
  articles: 'Articles',
};

/** What each tab's panel lists, as a phrase: "Couldn't load blog posts". */
export const MEDIA_SECTION_LABELS: Readonly<Record<MediaTab, string>> = {
  blog: 'blog posts',
  presentations: 'presentations',
  talks: 'talks',
  videos: 'videos',
  articles: 'articles',
};

const isMediaTab = (value: unknown): value is MediaTab =>
  typeof value === 'string' && (MEDIA_TABS as readonly string[]).includes(value);

/**
 * The tab a `?tab=` value names. A missing value, a repeated one (`?tab=a&tab=b` arrives as an
 * array) and an unknown one all give {@link DEFAULT_MEDIA_TAB}, so the page never renders an
 * empty panel.
 */
export function parseMediaTab(value: unknown): MediaTab {
  return isMediaTab(value) ? value : DEFAULT_MEDIA_TAB;
}
