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
 * @file The ways to sponsor and where each link opens. Pure data and shaping, no React: the rows
 * pick their icons by id. GitHub Sponsors leads (it is also the page's primary action); a way with
 * no usable link is left out rather than drawn as a dead row.
 */

import { destinationOf } from '@/components/console/tile-link';

export type SponsorWayId = 'github-sponsors' | 'open-collective' | 'ko-fi' | 'buy-me-a-coffee';

export interface SponsorWaySource {
  readonly id: SponsorWayId;
  readonly name: string;
  readonly url: string;
  /** One sentence-case line on what the way is for. No handle: Ko-fi's is an opaque id. */
  readonly purpose: string;
}

/** Where a link goes and whether it leaves for a new tab. */
export interface LinkTarget {
  readonly href: string;
  readonly newTab: boolean;
}

export interface SponsorWay extends SponsorWaySource, LinkTarget {}

/** The way the page leads with, as its first row and its "Sponsor on GitHub" action. */
export const PRIMARY_WAY_ID: SponsorWayId = 'github-sponsors';

/** The old page's four platforms, in its order, with its lines made plainer. */
export const SPONSOR_WAYS: readonly SponsorWaySource[] = [
  {
    id: 'github-sponsors',
    name: 'GitHub Sponsors',
    url: 'https://github.com/sponsors/WomB0ComB0',
    purpose: 'Monthly or one-time, straight through GitHub.',
  },
  {
    id: 'open-collective',
    name: 'Open Collective',
    url: 'https://opencollective.com/mike-odnis',
    purpose: 'Funding with every expense shown in public.',
  },
  {
    id: 'ko-fi',
    name: 'Ko-fi',
    url: 'https://ko-fi.com/Y8Y77AJEA',
    purpose: 'A quick one-time tip.',
  },
  {
    id: 'buy-me-a-coffee',
    name: 'Buy Me a Coffee',
    url: 'https://www.buymeacoffee.com/mikeodnis',
    purpose: 'A coffee-sized thank-you.',
  },
];

/** Schemes that hand off to an app on this device, so they never need a tab of their own. */
const SAME_TAB_SCHEME = /^(?:mailto|tel):/i;
const WEB_SCHEME = /^https?:\/\//i;
/**
 * A path on this site: one slash, then anything but a second slash or a backslash, with no
 * control character anywhere. A browser reads a backslash as a slash and drops tabs and newlines,
 * so '/\evil.example' or a slash, a tab and '/evil.example' would open another site.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses.
const SITE_PATH = /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/;

/**
 * Where `href` leads and how it opens, or null when it should not be linked at all.
 *
 * - blank or a bare '#' (no destination): null;
 * - mailto: and tel: open the mail or phone app, so they stay in this tab;
 * - a path on this site ('/sponsor') stays in this tab;
 * - http(s) opens in a new tab;
 * - anything else (javascript:, data:, a protocol-relative '//host', a '/\host' that a browser
 *   reads as one): null, never linked.
 */
export function linkTargetOf(href: string | undefined): LinkTarget | null {
  const destination = destinationOf(href);
  if (destination === null) return null;
  if (SAME_TAB_SCHEME.test(destination)) return { href: destination, newTab: false };
  if (WEB_SCHEME.test(destination)) return { href: destination, newTab: true };
  if (SITE_PATH.test(destination)) return { href: destination, newTab: false };
  return null;
}

export interface AnchorAttrs {
  readonly href: string;
  readonly target?: '_blank';
  readonly rel?: 'noopener noreferrer';
}

/**
 * The anchor attributes for a target: a new tab gets target and rel (so the opened page cannot
 * reach back through window.opener), a same-tab link gets neither.
 */
export function anchorAttrs({ href, newTab }: LinkTarget): AnchorAttrs {
  return newTab ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };
}

/**
 * The ways as the page lists them: each with its trimmed link, a way with no usable link left out,
 * a repeated id listed once (the first wins), and the primary way first with the rest in their
 * given order. Returns a new list; the input is not touched.
 */
export function shapeWays(
  sources: readonly SponsorWaySource[],
  primaryId: SponsorWayId = PRIMARY_WAY_ID,
): readonly SponsorWay[] {
  const seen = new Set<SponsorWayId>();
  const ways: SponsorWay[] = [];
  for (const source of sources) {
    const target = linkTargetOf(source.url);
    if (target === null || seen.has(source.id)) continue;
    seen.add(source.id);
    ways.push({ ...source, ...target });
  }
  const primary = ways.filter((item) => item.id === primaryId);
  return [...primary, ...ways.filter((item) => item.id !== primaryId)];
}
