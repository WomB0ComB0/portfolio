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
 * @file Which written piece and which video are two versions of one thing on /media. Pure; the
 * server calls it once (load-feed.ts) and the lab applies its sample rule through it. The island
 * never imports it: media-feed.ts, which the island does import, only carries the result.
 *
 * A pair is always one written entry (a post or an article) and one filmed entry (a video or a
 * stream upload), and it always points both ways: no piece is the other version of two. Talks
 * and presentations take no part. Pairs are made in this order, and a piece that has one keeps it:
 *  1. a rule in the map (media-pairs.ts);
 *  2. two pieces that link each other (the video's description links the post and the post
 *     embeds or links the video), when neither does so with anything else;
 *  3. the one written and the one filmed entry that carry the same title.
 *
 * A wrong reference is worse than none, so the signals are narrow on purpose:
 *  - A link one way is a reference, not a version, and pairs nothing: a description that lists a
 *    post under "Resources Mentioned in the Video" does not make that post the video's written
 *    version, however few videos list it, and a post that embeds a video is not that video's
 *    write-up unless the video says so too. Such a pair belongs in the map.
 *  - A link must be the piece's own address: the same host (without www.) and path. The blog's
 *    home page, a longer address and a share link that only carries the address are not it.
 *  - Two pieces that link each other are "the same piece" only when nothing else competes: a
 *    video and two posts that all link each other, or a post and the two videos it embeds, pair
 *    nothing.
 *  - A title pairs only when it has TITLE_MIN_WORDS words or more and exactly one written and one
 *    filmed entry carry it, so a recurring title ("Weekly update", 27 uploads of one stream)
 *    pairs nothing.
 * The map's MEDIA_NOT_PAIRS stops any one pairing: its link is then read as if it were not there.
 */

import { normalizeTitle } from '@/lib/api-integrations/blog-merge';
import {
  type FeedEntry,
  type FeedKind,
  type FeedPair,
  type FeedSources,
  postHref,
} from './media-feed';
import { entryKey, linkKey, linksIn, urlKey, videoKey } from './media-links';
import type { MediaPairRule } from './media-pairs';

/** "from links to": keys are 'yt:<video id>' or 'url:<host and path>'. */
export interface PairEdge {
  readonly from: string;
  readonly to: string;
}

/** The map's two lists. */
export interface PairRules {
  readonly pairs: readonly MediaPairRule[];
  readonly notPairs: readonly MediaPairRule[];
}

type Medium = 'written' | 'filmed';

/** The fewest words a title needs before two pieces sharing it are taken for one piece. */
const TITLE_MIN_WORDS = 3;

const MEDIUM_OF: Readonly<Partial<Record<FeedKind, Medium>>> = {
  post: 'written',
  article: 'written',
  video: 'filmed',
  stream: 'filmed',
};

/**
 * What the sources say links what: each video to every link in its description, and each post
 * to every video its body embeds or links (`videoIds`, read by the blog loader). Keys only; which
 * of them are pieces in the feed is pairEntries' business.
 */
export function pairSignals(sources: Partial<FeedSources>): PairEdge[] {
  const edges: PairEdge[] = [];
  for (const video of sources.videos ?? []) {
    for (const link of linksIn(video.description)) {
      const to = linkKey(link);
      if (to !== null) edges.push({ from: `yt:${video.videoId}`, to });
    }
  }
  for (const post of sources.posts ?? []) {
    const href = postHref(post);
    const from = href === null ? null : urlKey(href);
    if (from === null) continue;
    for (const videoId of post.videoIds ?? []) edges.push({ from, to: `yt:${videoId}` });
  }
  return edges;
}

/** A rule as the two keys the feed pairs by; null when either side cannot be read. */
export function ruleKeys(
  rule: MediaPairRule,
): { readonly written: string; readonly video: string } | null {
  const written = urlKey(rule.written);
  const video = videoKey(rule.video);
  return written === null || video === null ? null : { written, video };
}

/** A pairing as one string, written piece first, for the blocked set. */
const pairingId = (written: string, video: string): string => `${written} ${video}`;

/** An entry as the other side sees it; null when it has no address to link. */
const asPair = (entry: FeedEntry): FeedPair | null =>
  entry.href === null
    ? null
    : {
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        href: entry.href,
        videoId: entry.videoId,
      };

interface Piece {
  readonly entry: FeedEntry;
  readonly key: string;
  readonly medium: Medium;
}

/** The pieces that can pair, by key: written and filmed entries that have one (the first wins). */
function piecesByKey(entries: readonly FeedEntry[]): Map<string, Piece> {
  const pieces = new Map<string, Piece>();
  for (const entry of entries) {
    const medium = MEDIUM_OF[entry.kind];
    const key = entryKey(entry);
    if (medium && key !== null && !pieces.has(key)) pieces.set(key, { entry, key, medium });
  }
  return pieces;
}

/** Adds `value` to the set under `key`. */
function addTo(sets: Map<string, Set<string>>, key: string, value: string): void {
  const set = sets.get(key);
  if (set) set.add(value);
  else sets.set(key, new Set([value]));
}

/** The one value of a set that holds exactly one; null otherwise. */
function onlyOf(set: ReadonlySet<string> | undefined): string | null {
  if (set?.size !== 1) return null;
  const [only] = set;
  return only ?? null;
}

/** Each key's partners, and the pairs among them where each is the other's only partner. */
function exclusivePairs(partners: ReadonlyMap<string, ReadonlySet<string>>): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, set] of partners) {
    const other = onlyOf(set);
    if (other !== null && key < other && onlyOf(partners.get(other)) === key) {
      pairs.push([key, other]);
    }
  }
  return pairs;
}

/**
 * The pairs the links make: two pieces that link each other, and do so with nothing else. A link
 * one way pairs nothing (see the file comment). `may` says whether two keys may pair at all (both
 * in the feed, different mediums, not blocked); an edge that may not is not read.
 */
function linkPairs(
  edges: readonly PairEdge[],
  may: (a: string, b: string) => boolean,
): [string, string][] {
  const kept = edges.filter(({ from, to }) => may(from, to));
  const said = new Set(kept.map(({ from, to }) => `${from} ${to}`));
  const mutual = new Map<string, Set<string>>();
  for (const { from, to } of kept) {
    if (said.has(`${to} ${from}`)) addTo(mutual, from, to);
  }
  return exclusivePairs(mutual);
}

/** A title as the key two pieces must share: normalised, or null when too short to trust. */
function titleKey(title: string): string | null {
  const normalised = normalizeTitle(title);
  return normalised.split(' ').filter(Boolean).length >= TITLE_MIN_WORDS ? normalised : null;
}

/**
 * The same-title pairs: one for each title of TITLE_MIN_WORDS words or more that exactly one
 * written and one filmed piece carry.
 */
function titlePairs(pieces: ReadonlyMap<string, Piece>): [string, string][] {
  const byTitle = new Map<string, Record<Medium, string[]>>();
  for (const piece of pieces.values()) {
    const title = titleKey(piece.entry.title);
    if (title === null) continue;
    const group = byTitle.get(title) ?? { written: [], filmed: [] };
    group[piece.medium].push(piece.key);
    byTitle.set(title, group);
  }
  const pairs: [string, string][] = [];
  for (const { written, filmed } of byTitle.values()) {
    const [post] = written;
    const [video] = filmed;
    if (written.length === 1 && filmed.length === 1 && post && video) pairs.push([post, video]);
  }
  return pairs;
}

/** The rules as key pairs, unreadable ones dropped. */
const readRules = (rules: readonly MediaPairRule[]) =>
  rules.map(ruleKeys).filter((keys) => keys !== null);

/**
 * The entries, each written or filmed one with its pair (see the file comment for the order and
 * the limits). Returns new entries in the same order; the input is not modified.
 */
export function pairEntries(
  entries: readonly FeedEntry[],
  edges: readonly PairEdge[],
  rules: PairRules,
): FeedEntry[] {
  const pieces = piecesByKey(entries);
  const blocked = new Set(
    readRules(rules.notPairs).map(({ written, video }) => pairingId(written, video)),
  );

  /** Whether two keys may pair: both pieces of the feed with an address, of different mediums, not blocked. */
  const may = (a: string, b: string): boolean => {
    const one = pieces.get(a);
    const other = pieces.get(b);
    if (!one || !other || one.medium === other.medium) return false;
    if (one.entry.href === null || other.entry.href === null) return false;
    const [written, filmed] = one.medium === 'written' ? [a, b] : [b, a];
    return !blocked.has(pairingId(written, filmed));
  };

  const partnerOf = new Map<string, string>();
  /** Pairs two keys, unless they may not pair or either already has its pair. */
  const join = (a: string, b: string): void => {
    if (partnerOf.has(a) || partnerOf.has(b) || !may(a, b)) return;
    partnerOf.set(a, b);
    partnerOf.set(b, a);
  };

  for (const rule of readRules(rules.pairs)) join(rule.written, rule.video);
  for (const [a, b] of linkPairs(edges, may)) join(a, b);
  for (const [a, b] of titlePairs(pieces)) join(a, b);

  const pairOf = new Map<string, FeedPair>();
  for (const [key, otherKey] of partnerOf) {
    const piece = pieces.get(key);
    const other = pieces.get(otherKey);
    const pair = other ? asPair(other.entry) : null;
    if (piece && pair) pairOf.set(piece.entry.id, pair);
  }
  return entries.map((entry) => ({ ...entry, pair: pairOf.get(entry.id) ?? null }));
}

/**
 * One rule on top of the pairs the entries already have (the lab's sample pair): both pieces it
 * names point at each other, a piece that pointed at either lets go, and every other entry keeps
 * its pair. A rule that cannot be read, or names a piece that is not in the feed, changes
 * nothing. Returns new entries.
 */
export function applyPairRule(entries: readonly FeedEntry[], rule: MediaPairRule): FeedEntry[] {
  const keys = ruleKeys(rule);
  const pieces = piecesByKey(entries);
  const written = keys ? pieces.get(keys.written) : undefined;
  const filmed = keys ? pieces.get(keys.video) : undefined;
  const toFilmed = filmed ? asPair(filmed.entry) : null;
  const toWritten = written ? asPair(written.entry) : null;
  if (!written || !filmed || written.medium === filmed.medium || !toFilmed || !toWritten) {
    return [...entries];
  }
  return entries.map((entry) => {
    if (entry.id === written.entry.id) return { ...entry, pair: toFilmed };
    if (entry.id === filmed.entry.id) return { ...entry, pair: toWritten };
    const taken = entry.pair?.id === written.entry.id || entry.pair?.id === filmed.entry.id;
    return taken ? { ...entry, pair: null } : entry;
  });
}
