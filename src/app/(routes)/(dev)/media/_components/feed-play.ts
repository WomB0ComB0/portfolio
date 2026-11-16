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
 * @file How a link on /media says it plays in place. With the embed option, a link to a YouTube
 * upload carries data-play instead of a new-tab target; the island's one click listener
 * (media-feed-index.tsx) opens the player from it, and without JavaScript the link still goes to
 * YouTube. Shared by a row's title, a folded stream's parts and a "Video version" note.
 * Server-safe.
 */

import type { PlayMode } from '../_lib/media-options';

/** What a link needs to play in place: somewhere to go without JavaScript, and a YouTube id. */
interface Playable {
  readonly href: string | null;
  readonly videoId: string | null;
}

/** What the island reads off a link that plays in place: the video and the player's title. */
export interface PlayAttributes {
  readonly 'data-play': string;
  readonly 'data-play-title': string;
  readonly 'aria-haspopup': 'dialog';
}

/** Whether `item`'s link opens the in-page player rather than YouTube. */
export const playsHere = (item: Playable, play: PlayMode): boolean =>
  play === 'embed' && item.videoId !== null && item.href !== null;

/**
 * The attributes of `item`'s link when it plays in place, under `title` in the player; null
 * when it goes out instead (links out, or not a YouTube upload).
 */
export function playAttributes(
  item: Playable,
  play: PlayMode,
  title: string,
): PlayAttributes | null {
  if (play !== 'embed' || item.videoId === null || item.href === null) return null;
  return { 'data-play': item.videoId, 'data-play-title': title, 'aria-haspopup': 'dialog' };
}
