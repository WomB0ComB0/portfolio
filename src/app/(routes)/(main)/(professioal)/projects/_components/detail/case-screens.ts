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
 * @file A project's screens, pure and server-safe: the cover first, then the gallery, each image
 * once, with its real shape read from the Sanity asset id (`image-<hash>-<w>x<h>-<format>`, less
 * any Studio crop) and its words from Studio (the caption, else the alt text, else none: nothing
 * is written in their place). Also how the page frames them:
 * - the cover sits in a browser frame only when it is a web page's shape and the project has a
 *   live site, whose real address the frame's bar shows; any other cover (a logo, a portrait, a
 *   project with no live site) sits as a print, at its own shape;
 * - the second screen peeks behind the cover, or stands in front of its corner when it is a phone;
 * - the Screens section holds every screen but the cover (the header already shows it), each
 *   keeping its place in the viewer ('Fig. 2' onwards): one as a single figure, two as a strip,
 *   three or more as a contact sheet. All keep each screen's shape; only a full-page capture
 *   taller than a phone is cut to a phone's shape from its top (the viewer shows it whole).
 */

import type { Project } from '@/hooks/sanity/schemas';

type SanityImage = NonNullable<Project['image']>;

/** One screen of the project, in page order. */
export interface Screen {
  /** The asset id: unique among the project's screens. */
  readonly key: string;
  readonly image: SanityImage;
  readonly width: number;
  readonly height: number;
  /** Width over height. */
  readonly ratio: number;
  /** Studio's caption, else its alt text; null when it has neither. */
  readonly words: string | null;
}

/** How the cover is framed. */
export type CoverFrame = 'browser' | 'print';
/** How the second screen joins the cover: behind its top corner, or as a phone in front. */
export type PeekStyle = 'behind' | 'phone';
/** How the Screens section lays out. */
export type ScreensLayout = 'single' | 'strip' | 'sheet';

/** A screen in the Screens section, with its place among all of them (the viewer's index). */
export interface PlacedScreen {
  readonly screen: Screen;
  /** 0 is the cover; the section starts at 1. */
  readonly index: number;
}

/** A Sanity image asset id, with its size. */
const ASSET_ID = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/u;
/** A web page's shape: from 4:3-ish to a wide 2.4:1. */
const WEB_RATIO = { min: 1.3, max: 2.4 } as const;
/** Narrower than this, a second screen may be a phone (780 x 1688 is 0.46). */
const PHONE_RATIO = 0.8;
/**
 * A phone screenshot is at most this many pixels wide (a 3x phone is 1170 to 1320); a desktop
 * page captured whole is wider (2880 at 2x), and peeks from behind like any other page.
 */
const PHONE_MAX_WIDTH = 1600;
/** The tallest shape a tile keeps: a phone's. A full-page capture is cut to it from the top. */
const TALLEST_TILE = 0.46;
/** The widest shape a tile keeps. */
const WIDEST_TILE = 2.4;
/** From this many screens the section is a contact sheet; two make a strip, one a figure. */
const SHEET_FROM = 3;

const tidy = (text: string | undefined): string | null => {
  const words = (text ?? '').replace(/\s+/gu, ' ').trim();
  return words === '' ? null : words;
};

const clampUnit = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** The image's size as drawn: the asset's, less the Studio crop. Null for a malformed id. */
function sizeOf(image: SanityImage): { width: number; height: number } | null {
  const match = ASSET_ID.exec(image.asset?._ref ?? '');
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  if (!(width > 0 && height > 0)) return null;
  const crop = image.crop;
  const keepX = 1 - clampUnit(crop?.left) - clampUnit(crop?.right);
  const keepY = 1 - clampUnit(crop?.top) - clampUnit(crop?.bottom);
  if (keepX <= 0 || keepY <= 0) return { width, height };
  return { width: Math.round(width * keepX), height: Math.round(height * keepY) };
}

/** The cover, then the gallery, each asset once; images with a malformed id are left out. */
export function screensOf(project: Pick<Project, 'image' | 'images'>): Screen[] {
  const seen = new Set<string>();
  const screens: Screen[] = [];
  for (const image of [project.image, ...(project.images ?? [])]) {
    const size = image ? sizeOf(image) : null;
    if (!image || !size || seen.has(image.asset._ref)) continue;
    seen.add(image.asset._ref);
    screens.push({
      key: image.asset._ref,
      image,
      ...size,
      ratio: size.width / size.height,
      words: tidy(image.caption) ?? tidy(image.alt),
    });
  }
  return screens;
}

/** A browser frame for a web page's shape on a project with a live site; a print otherwise. */
export function coverFrame(cover: Screen, hasLiveSite: boolean): CoverFrame {
  const webShape = cover.ratio >= WEB_RATIO.min && cover.ratio <= WEB_RATIO.max;
  return hasLiveSite && webShape ? 'browser' : 'print';
}

/**
 * A phone screenshot stands in front of the cover's corner; anything else (a wider screen, or a
 * desktop page captured whole) peeks from behind it, cut to a page's shape from its top.
 */
export const peekStyle = (screen: Screen): PeekStyle =>
  screen.ratio < PHONE_RATIO && screen.width <= PHONE_MAX_WIDTH ? 'phone' : 'behind';

/**
 * The Screens section's screens: every one after the cover, which the header already shows, each
 * with its index among all of them, so its figure number and the viewer agree.
 */
export const sectionScreens = (screens: readonly Screen[]): PlacedScreen[] =>
  screens.slice(1).map((screen, at) => ({ screen, index: at + 1 }));

/** One screen as a figure, two as a strip, three or more as a contact sheet; none for none. */
export function screensLayout(count: number): ScreensLayout | null {
  if (count < 1) return null;
  if (count === 1) return 'single';
  return count >= SHEET_FROM ? 'sheet' : 'strip';
}

/** A tile's shape: the screen's own, held between a phone's and 2.4:1. */
export const tileRatio = (ratio: number): number =>
  Math.min(WIDEST_TILE, Math.max(TALLEST_TILE, ratio));

/** Whether a tile cuts the screen (a full-page capture), so it shows the page's top. */
export const isCut = (ratio: number): boolean => ratio < TALLEST_TILE || ratio > WIDEST_TILE;

/** A ratio as CSS reads it, to four places: '1.7778'. */
export const cssRatio = (ratio: number): string => String(Math.round(ratio * 10_000) / 10_000);

/**
 * What a screen's link is called: 'Open screen 2 of 4: RamHacks sponsorship tiers', or without
 * words 'Open screen 2 of 4'. A project's only screen is 'Open the cover'.
 */
export function openLabel(index: number, count: number, words: string | null): string {
  const what = count === 1 ? 'Open the cover' : `Open screen ${index + 1} of ${count}`;
  return words ? `${what}: ${words}` : what;
}

/**
 * The cover link's name. In a browser frame the link shows the live site's address in the bar,
 * so its name starts with that address as shown (WCAG 2.5.3, Label in Name: a voice user can say
 * what they see), then says what opening it does: 'grepo.example.com, open screen 1 of 3: grepo
 * cover'. A print shows no words, so its name is openLabel's.
 *
 * @param shownHost - The address the frame's bar shows; null for a print, which has no bar.
 */
export function coverLabel(count: number, words: string | null, shownHost: string | null): string {
  const open = openLabel(0, count, words);
  if (!shownHost) return open;
  return `${shownHost}, ${open.charAt(0).toLowerCase()}${open.slice(1)}`;
}

/** The note under the cover: '4 screens' (with 'open one' beside it on the page). */
export const screensCount = (count: number): string =>
  `${count} ${count === 1 ? 'screen' : 'screens'}`;
