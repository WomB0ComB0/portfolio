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
 * @file Pairs /media cannot work out by itself, and pairs it works out that are wrong. A pair is
 * a written piece (a post or an article) and the video of it; the page then shows "Video version"
 * on the post's row and "Written version" on the video's (media-pairing.ts has the rules).
 *
 * In everyday use both lists stay empty: the page pairs a post and a video by itself when they
 * link each other (the video's YouTube description links the post and the post embeds or links
 * the video, and neither does so with another piece), or when exactly one post and one video
 * carry the same title (three words or more). A link one way pairs nothing: a post a video lists
 * among its resources is not that video's written version. Add a line here for a pair neither
 * signal reaches (a video that only links its post, say), or to stop one that is wrong.
 *
 * A rule names each piece by the address its row links to. Pure and server-safe.
 *
 * @example
 * // A pair by hand (placeholder addresses):
 * // { written: 'https://blog.example.dev/my-post', video: 'https://www.youtube.com/watch?v=VIDEO_ID_11' },
 */

/** A written piece and the video of it, by the addresses their rows link to. */
export interface MediaPairRule {
  /** The post's or article's URL, as its row links it. */
  readonly written: string;
  /** The video's YouTube URL, or its 11-character id. */
  readonly video: string;
}

/** Pairs the page cannot work out by itself. Read first: a rule wins over every other signal. */
export const MEDIA_PAIRS: readonly MediaPairRule[] = [];

/** Pairs the page works out that are wrong: these two never point at each other. */
export const MEDIA_NOT_PAIRS: readonly MediaPairRule[] = [];
