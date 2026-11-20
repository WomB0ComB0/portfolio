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
 * @file The Chart ledger's data: Spotify's raw top tracks and artists shaped into ranked rows,
 * and the header's figures. Pure (no directive; its one import, the art picker, is pure too), so
 * every rule is tested without rendering, and both the page and the lab station share it.
 *
 * Spotify's answers are untrusted: each item is narrowed field by field, an item without a name
 * is skipped (the rest are ranked again without a gap), links are kept only on open.spotify.com
 * and art only from Spotify's image CDN, the one host next.config lets next/image load, at the
 * smallest size that stays sharp (spotify-art.ts, which the API handlers share).
 */

import { spotifyArtFor } from '@/lib/images/spotify-art';

/** A track page or an artist page: the only links the ledger makes. */
const SPOTIFY_LINK_HOST = 'open.spotify.com';

/** The row's album art, drawn at 40px. */
export const TRACK_ART_PX = 40;
/** The strip's portraits, drawn at up to 64px. */
export const ARTIST_PORTRAIT_PX = 64;
/** How many artists the strip shows, of the 20 Spotify sends. */
export const ARTISTS_SHOWN = 10;
const UNKNOWN_ARTIST = 'Unknown artist';

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;

/** One ranked track, as the ledger prints it. */
export interface ChartTrack {
  /** 1-based, in Spotify's order. */
  readonly rank: number;
  /** React's key: Spotify's id, else the link, else the rank. */
  readonly key: string;
  readonly title: string;
  /** Every credited artist, comma separated, or 'Unknown artist'. */
  readonly artist: string;
  /** The credited artists one by one, for the header's count. */
  readonly artists: readonly string[];
  readonly album?: string;
  /** m:ss, or h:mm:ss past an hour. */
  readonly duration?: string;
  /** The same length for `<time dateTime>`, e.g. 'PT3M5S'. */
  readonly durationIso?: string;
  readonly durationMs?: number;
  /** The track's open.spotify.com page; a local file has none. */
  readonly href?: string;
  /** The album art at the row's size, from Spotify's CDN. */
  readonly art?: string;
}

/** One ranked artist for the strip. */
export interface ChartArtist {
  readonly rank: number;
  readonly key: string;
  readonly name: string;
  readonly href?: string;
  readonly image?: string;
}

/** The header's figures; null where the chart can't say. */
export interface ChartStats {
  readonly tracks: number;
  /** Different artists credited on the top tracks. */
  readonly artists: number | null;
  /** The top tracks back to back, in whole minutes. */
  readonly minutes: number | null;
}

/** A list section's data: the shaped list, or a failure the loader already reported. */
export type ChartListResult<T> =
  | { readonly status: 'ok'; readonly data: readonly T[] }
  | { readonly status: 'error' };

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` when it is a string with visible text; a blank string counts as missing. */
const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** `value` as an https URL on `hostname`, normalised, or undefined for anything else. */
function httpsUrlOn(value: unknown, hostname: string): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** `ms` when it is a finite, non-negative number of milliseconds; otherwise undefined. */
const lengthMs = (ms: unknown): number | undefined =>
  typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? ms : undefined;

interface LengthParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

/** A length split into whole hours, minutes and seconds (rounded down), or undefined. */
function lengthParts(ms: unknown): LengthParts | undefined {
  const known = lengthMs(ms);
  if (known === undefined) return undefined;
  const total = Math.floor(known / SECOND_MS);
  return {
    hours: Math.floor(total / HOUR_S),
    minutes: Math.floor((total % HOUR_S) / MINUTE_S),
    seconds: total % MINUTE_S,
  };
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/**
 * A track's length as Spotify prints it: m:ss, or h:mm:ss from an hour, seconds rounded down.
 * Undefined when `ms` is missing, negative or not a finite number.
 */
export function formatDuration(ms: unknown): string | undefined {
  const parts = lengthParts(ms);
  if (!parts) return undefined;
  const { hours, minutes, seconds } = parts;
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`
    : `${minutes}:${twoDigits(seconds)}`;
}

/**
 * The same length as an ISO 8601 duration ('PT1H2M5S'), for `<time dateTime>`: zero units are
 * left out, except the seconds of a zero length ('PT0S').
 */
export function durationIso(ms: unknown): string | undefined {
  const parts = lengthParts(ms);
  if (!parts) return undefined;
  const { hours, minutes, seconds } = parts;
  const units = [
    hours > 0 ? `${hours}H` : '',
    minutes > 0 ? `${minutes}M` : '',
    seconds > 0 || (hours === 0 && minutes === 0) ? `${seconds}S` : '',
  ];
  return `PT${units.join('')}`;
}

/** The credited artists' names, in Spotify's order, blanks dropped. */
function artistNames(artists: unknown): string[] {
  if (!Array.isArray(artists)) return [];
  return artists.flatMap((artist: unknown) => {
    const name = isRecord(artist) ? textOf(artist.name) : undefined;
    return name ? [name] : [];
  });
}

/** The item's open.spotify.com page, when it has one. */
const spotifyPage = (item: UnknownRecord): string | undefined =>
  isRecord(item.external_urls)
    ? httpsUrlOn(item.external_urls.spotify, SPOTIFY_LINK_HOST)
    : undefined;

/** A raw item that has a name to show, with that name trimmed. */
interface NamedItem {
  readonly item: UnknownRecord;
  readonly name: string;
}

/** The items with a name, in Spotify's order; the rest are dropped before ranking. */
function namedItems(raw: readonly unknown[]): NamedItem[] {
  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = textOf(item.name);
    return name ? [{ item, name }] : [];
  });
}

/** One named raw track at `rank`. */
function shapeTrack({ item, name }: NamedItem, rank: number): ChartTrack {
  const artists = artistNames(item.artists);
  const album = isRecord(item.album) ? item.album : undefined;
  const href = spotifyPage(item);
  const durationMs = lengthMs(item.duration_ms);
  return {
    rank,
    key: textOf(item.id) ?? href ?? `rank-${rank}`,
    title: name,
    artist: artists.length > 0 ? artists.join(', ') : UNKNOWN_ARTIST,
    artists,
    album: album ? textOf(album.name) : undefined,
    duration: formatDuration(durationMs),
    durationIso: durationIso(durationMs),
    durationMs,
    href,
    art: album ? spotifyArtFor(album.images, TRACK_ART_PX) : undefined,
  };
}

/**
 * Spotify's top tracks as ranked rows, in its order. An item without a title is skipped and the
 * rest are ranked from 1 without a gap.
 */
export function shapeTopTracks(raw: readonly unknown[]): ChartTrack[] {
  return namedItems(raw).map((named, index) => shapeTrack(named, index + 1));
}

/** One named raw artist at `rank`. */
function shapeArtist({ item, name }: NamedItem, rank: number): ChartArtist {
  const href = spotifyPage(item);
  return {
    rank,
    key: textOf(item.id) ?? href ?? `rank-${rank}`,
    name,
    href,
    image: spotifyArtFor(item.images, ARTIST_PORTRAIT_PX),
  };
}

/** Spotify's top artists, ranked as {@link shapeTopTracks} ranks tracks. */
export function shapeTopArtists(raw: readonly unknown[]): ChartArtist[] {
  return namedItems(raw).map((named, index) => shapeArtist(named, index + 1));
}

/**
 * The header's figures: how many top tracks, how many different artists are credited on them
 * (null when none is named) and their minutes back to back, rounded (null when no track has a
 * length).
 */
export function chartStats(tracks: readonly ChartTrack[]): ChartStats {
  const artists = new Set(tracks.flatMap((track) => track.artists));
  const lengths = tracks.flatMap((track) =>
    track.durationMs === undefined ? [] : [track.durationMs],
  );
  const totalMs = lengths.reduce((sum, ms) => sum + ms, 0);
  return {
    tracks: tracks.length,
    artists: artists.size > 0 ? artists.size : null,
    minutes: lengths.length > 0 ? Math.round(totalMs / (MINUTE_S * SECOND_MS)) : null,
  };
}
