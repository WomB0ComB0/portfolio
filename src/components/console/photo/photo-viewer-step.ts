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
 * @file The shared photo viewer's types and its small rules, pure and server-safe, so a server
 * page can build the items and the tests can read the rules without a browser:
 * - which image the keys and the arrows move to (round the ends, so a button never goes dead
 *   under focus);
 * - the caption's figure line ('Fig. 2 of 4');
 * - when an image is taller than a phone (a full-page capture), which the viewer scrolls instead
 *   of shrinking to a sliver;
 * - the shapes a set spans, which size the open view once for the whole set;
 * - the full-screen layout's query, read by the stylesheet and the script alike.
 */

/** One image the viewer can open. Built on the server; plain data. */
export interface ViewerItem {
  /** Unique among the items. */
  readonly key: string;
  /** The whole image at the size the open view needs (a remote URL next/image optimises). */
  readonly src: string;
  /** A small copy for the viewer's row of thumbnails. */
  readonly thumb: string;
  /** The image's size in pixels, for its shape. */
  readonly width: number;
  readonly height: number;
  /** Its caption or alt text; null when it has none (nothing is written in their place). */
  readonly words: string | null;
}

/** What the items are called: 'screen' / 'screens', 'photo' / 'photos'. */
export interface ViewerNoun {
  readonly one: string;
  readonly many: string;
}

export const PHOTO_NOUN: ViewerNoun = { one: 'photo', many: 'photos' };

/** A step the keyboard asks for: back, on, or to either end. */
export type KeyStep = -1 | 1 | 'first' | 'last';

/**
 * The viewer's full-screen layout: a phone, and any short window (a landscape phone, a laptop
 * zoomed to 200%), where a panel and its caption would not fit. photo-viewer.module.css repeats it.
 */
export const COMPACT_QUERY = '(width < 40rem), (height < 32rem)';

/** Taller than this (a phone is 0.46), the open view scrolls the image instead of shrinking it. */
export const TALL_RATIO = 0.45;

/** The index `delta` steps from `index`, round the ends; 0 when there is nothing to show. */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

/** The step a key asks for, or null for a key the viewer leaves alone. */
export function keyStep(key: string): KeyStep | null {
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}

/** Where a key step lands. */
export function stepTo(step: KeyStep, index: number, count: number): number {
  if (step === 'first') return 0;
  if (step === 'last') return Math.max(0, count - 1);
  return stepIndex(index, step, count);
}

/** The caption's figure line: 'Fig. 2 of 4', or 'Fig. 1' for a single image. */
export const figureLabel = (index: number, count: number): string =>
  count > 1 ? `Fig. ${index + 1} of ${count}` : `Fig. ${index + 1}`;

/** Whether an image is taller than a phone, so the open view scrolls it. */
export const isTall = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width / height < TALL_RATIO;

/** A shape for an image whose size is unknown. */
const DEFAULT_RATIO = 16 / 9;

/** An image's shape, width over height; 16:9 when its size is unknown. */
export const ratioOf = ({ width, height }: Pick<ViewerItem, 'width' | 'height'>): number =>
  width > 0 && height > 0 ? width / height : DEFAULT_RATIO;

/**
 * The shapes a set spans, which size the open view once for the whole set, so stepping never
 * resizes it and Previous and Next stay under the pointer.
 */
export interface SetShape {
  /** The widest shape that is not a tall capture; 0 when every image is one. */
  readonly wide: number;
  /** The narrowest shape that is not a tall capture; 1 when every image is one. */
  readonly narrow: number;
  /** Whether a tall capture (a scrolling column) is among them. */
  readonly tall: boolean;
}

/** The set's widest and narrowest shapes, and whether it holds a tall capture. */
export function setShape(items: readonly Pick<ViewerItem, 'width' | 'height'>[]): SetShape {
  const ratios = items.filter((each) => !isTall(each.width, each.height)).map(ratioOf);
  const tall = ratios.length < items.length;
  if (ratios.length === 0) return { wide: 0, narrow: 1, tall };
  return { wide: Math.max(...ratios), narrow: Math.min(...ratios), tall };
}

/** A thumbnail's name: 'Screen 2 of 4'. */
export const thumbLabel = (index: number, count: number, noun: ViewerNoun): string =>
  `${noun.one.charAt(0).toUpperCase()}${noun.one.slice(1)} ${index + 1} of ${count}`;
