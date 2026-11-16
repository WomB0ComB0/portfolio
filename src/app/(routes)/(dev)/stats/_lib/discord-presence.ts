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
 * @file The Discord tile's pure parts: the status in the palette's words and tones, a Lanyard
 * parser for the island's poll, which answer a poll shows and when it was read, and the activity
 * rows. No directive and
 * no Effect, so the island's bundle stays small; the island (discord-tile.tsx) is their only
 * caller outside the tests.
 *
 * The rows keep the card's behaviour from #592 (memory: discord-lanyard-activity): custom status
 * is left out, listening comes first, then playing, streaming, watching and competing; at most
 * three rows; album art only from `spotify:<id>` assets; and when Discord reports no listening
 * (some clients don't publish Spotify), Spotify's own now playing leads.
 */

import { LiveResponseError } from '@/app/_components/home/live/live-fetch';
import type { LanyardData } from '@/app/api/v1/[[...route]]/lanyard/handlers';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import type { StatusTone } from '@/components/console';

/**
 * Discord activity types, as Lanyard reports them.
 * @see https://discord.com/developers/docs/events/gateway-events#activity-object-activity-types
 */
export const ActivityType = {
  Playing: 0,
  Streaming: 1,
  Listening: 2,
  Watching: 3,
  Custom: 4,
  Competing: 5,
} as const;

/** One activity, as Lanyard sends it once nulls are dropped. */
export interface PresenceActivity {
  readonly name: string;
  readonly type: number;
  readonly state?: string;
  readonly details?: string;
  readonly assets?: { readonly large_image?: string; readonly large_text?: string };
}

/** The status as words and a StatusDot tone. Only online pulses (the dot of a live source). */
export interface PresenceTone {
  readonly word: string;
  readonly tone: StatusTone;
  readonly pulse: boolean;
}

const TONES: Readonly<Record<string, PresenceTone>> = {
  online: { word: 'Online', tone: 'live', pulse: true },
  idle: { word: 'Idle', tone: 'ongoing', pulse: false },
  dnd: { word: 'Do not disturb', tone: 'down', pulse: false },
};
const OFFLINE: PresenceTone = { word: 'Offline', tone: 'idle', pulse: false };

/** Discord's status on the palette: online live, idle ongoing, dnd down; anything else offline. */
export const presenceTone = (status: string): PresenceTone => TONES[status] ?? OFFLINE;

/**
 * The longest status word there is ('Do not disturb'), read from the words above so the two
 * cannot drift apart. The tile lays every status out in this word's room, so where its head row
 * breaks never depends on the status.
 */
export const WIDEST_PRESENCE_WORD: string = [...Object.values(TONES), OFFLINE]
  .map((tone) => tone.word)
  .reduce((widest, word) => (word.length > widest.length ? word : widest));

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `object[key]` as a string: absent or null is undefined, any other type throws. */
function optionalString(object: JsonObject, key: string, what: string): string | undefined {
  const value = object[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new LiveResponseError(`${what}.${key} is not a string`);
  return value;
}

/** `object[key]` as a string; absent, null or any other type throws. */
function requiredString(object: JsonObject, key: string, what: string): string {
  const value = optionalString(object, key, what);
  if (value === undefined) throw new LiveResponseError(`${what}.${key} is missing`);
  return value;
}

/** A copy of `entries` with only the fields that have a value, so absent stays absent. */
const defined = <T extends object>(entries: T): T =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined)) as T;

/** One activity: a missing or null optional field is left out, a wrong type throws. */
function parseActivity(value: unknown): PresenceActivity {
  if (!isObject(value)) throw new LiveResponseError('activity is not an object');
  if (typeof value.type !== 'number') throw new LiveResponseError('activity.type is not a number');
  const assets = isObject(value.assets)
    ? defined({
        large_image: optionalString(value.assets, 'large_image', 'activity.assets'),
        large_text: optionalString(value.assets, 'large_text', 'activity.assets'),
      })
    : undefined;
  return defined({
    name: requiredString(value, 'name', 'activity'),
    type: value.type,
    state: optionalString(value, 'state', 'activity'),
    details: optionalString(value, 'details', 'activity'),
    assets,
  });
}

/**
 * The /api/v1/lanyard answer, checked by hand (the island has no Effect). Missing activities are
 * none; nulls are missing.
 * @throws {LiveResponseError} For an answer of the wrong shape.
 */
export function parseLanyard(json: unknown): LanyardData {
  if (!isObject(json)) throw new LiveResponseError('Lanyard answer is not an object');
  const user = json.discord_user;
  if (!isObject(user)) throw new LiveResponseError('discord_user is not an object');
  const activities = json.activities ?? [];
  if (!Array.isArray(activities)) throw new LiveResponseError('activities is not an array');
  return {
    discord_status: requiredString(json, 'discord_status', 'lanyard'),
    discord_user: {
      username: requiredString(user, 'username', 'discord_user'),
      discriminator: optionalString(user, 'discriminator', 'discord_user') ?? '0',
      avatar: optionalString(user, 'avatar', 'discord_user') ?? '',
      id: requiredString(user, 'id', 'discord_user'),
    },
    activities: activities.map(parseActivity),
  };
}

/**
 * The earliest read time taken at its word: 10^12 ms is September 2001. Anything below it is not
 * epoch milliseconds (seconds sent by mistake read as January 1970, 'updated 20750 d ago').
 */
const EARLIEST_READ_AT_MS = 1e12;

/**
 * When the server says it read the presence in `json` from Lanyard: its `read_at`, as epoch
 * milliseconds or an ISO time, by the server's clock. Undefined when the answer does not say, or
 * says something it cannot mean (a time before {@link EARLIEST_READ_AT_MS}).
 */
export function statedReadAt(json: unknown): number | undefined {
  const value = isObject(json) ? json.read_at : undefined;
  const at =
    typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) && at >= EARLIEST_READ_AT_MS ? at : undefined;
}

/**
 * A presence the tile shows: when it was read from Lanyard, by the server's clock for ordering
 * reads and by this browser's for its age line, and when it reached this browser.
 */
export interface DatedPresence {
  readonly presence: LanyardData;
  /**
   * When it was read, by this browser's clock (epoch ms): its arrival less how old the read was
   * when the server served it (both of those by the server's clock), so no offset between the
   * two clocks enters it. Never later than {@link arrivedAt}. With no time of serve (an answer
   * without a Date), the server's word taken on this browser's clock, never later than the
   * arrival; with no word, the arrival. The age line counts from this. A presence kept over a
   * step of that clock is carried along with the step (see {@link arrivedMono}).
   */
  readonly readAt: number;
  /**
   * When it reached this browser (epoch ms, by this browser's clock as it read when the presence
   * was last dated: a step of that clock since is added to it and to {@link readAt} together).
   */
  readonly arrivedAt: number;
  /**
   * When it reached this browser by its monotonic clock (performance.now(), ms), which no step
   * of the wall clock moves. Absent when the caller did not read it. Polls measure the time since
   * this arrival by it (keepsShown), and tell a step of the wall clock by it (onThisClock).
   */
  readonly arrivedMono?: number;
  /**
   * The server's own word for when it read the presence, as it gave it (its clock): the page
   * snapshot's time or a poll's `read_at`. Absent when the answer did not say. The same read
   * polled again is known by it.
   */
  readonly statedAt?: number;
  /**
   * When it was read by the server's clock: {@link statedAt}, but never later than the server
   * says it served it. Reads are ordered by this. Absent when the answer did not say.
   */
  readonly serverReadAt?: number;
}

/**
 * How much later than its Date (plus Age) the server may really have served an answer: both
 * headers are whole seconds, rounded down. A read_at up to this far past them is taken as given.
 */
const HEADER_SLACK_MS = 2_000;

/**
 * Wall-clock moves between two arrivals, beyond what the monotonic clock counted, smaller than
 * this are drift (a clock being slewed runs a few ms per minute off); from this up, a step.
 */
const CLOCK_STEP_MS = 1_000;

/**
 * When a poll's request left and its answer arrived, by this browser's monotonic clock
 * (performance.now(), ms). A step of the device's wall clock (a time sync after waking, a manual
 * change) moves neither.
 */
export interface PollTimes {
  readonly sent: number;
  readonly received: number;
}

/**
 * When the server served an answer, as far as this browser can tell: no later than `by` (its
 * clock), with the server's clock `offset` ahead of this browser's (behind when negative).
 */
interface Serve {
  readonly by: number;
  readonly offset: number;
}

/**
 * The serve of an answer that reached this browser at `arrivedAt`: by `servedAt` (the server's
 * time when it served it, `slackMs` coarse) when it is known. When it is not (no Date header),
 * this browser's clock stands in for the server's: served at its arrival, no offset. That is how
 * the tile dated every read before the header was read.
 */
const serveOf = (arrivedAt: number, servedAt: number | undefined, slackMs: number): Serve =>
  servedAt === undefined
    ? { by: arrivedAt, offset: 0 }
    : { by: servedAt + slackMs, offset: servedAt - arrivedAt };

/** `dated` with its monotonic arrival, when the caller read one. */
const withMono = (dated: DatedPresence, arrivedMono: number | undefined): DatedPresence =>
  arrivedMono === undefined ? dated : { ...dated, arrivedMono };

/** A presence the server says it read at `statedAt`, served as `serve`, arrived at `arrivedAt`. */
function datedBy(
  presence: LanyardData,
  statedAt: number,
  arrivedAt: number,
  serve: Serve,
  arrivedMono?: number,
): DatedPresence {
  const serverReadAt = Math.min(statedAt, serve.by);
  const readAt = Math.min(serverReadAt - serve.offset, arrivedAt);
  return withMono({ presence, readAt, arrivedAt, statedAt, serverReadAt }, arrivedMono);
}

/**
 * The page snapshot as the tile first shows it: read at `fetchedAt` and served at `renderedAt`,
 * both by the server's clock, and arrived `now` (`nowMono` by the monotonic clock), when the
 * render runs. Its age line counts from its age when the server rendered the page, so it reads
 * the same by any browser clock. (The page is rendered on each request, so the render is its
 * serve.) On the server it changes nothing. Without `renderedAt`, this browser's clock stands in
 * for the server's (see serveOf).
 */
export const snapshotPresence = (
  presence: LanyardData,
  fetchedAt: number,
  now: number,
  renderedAt?: number,
  nowMono?: number,
): DatedPresence => datedBy(presence, fetchedAt, now, serveOf(now, renderedAt, 0), nowMono);

/**
 * The latest the presence shown (read at `serverReadAt` by its server's clock, arrived at
 * `arrivedMono`) can have been read, by the clock of the server that served the answer `serve`,
 * whose request left at `sentMono` (both monotonic, when known).
 *
 * It is the shown read's own server read time, but no later than this answer's serve less the
 * monotonic time from the shown answer's arrival to this request's start: the shown read came
 * before its arrival, the request left after it, and the answer was served after the request
 * left. That keeps one server whose whole clock runs ahead (its Date as far ahead as its
 * read_at) from holding the tile until real time catches up with it.
 *
 * The floor: while the servers keep the right time, the bound is never earlier than the shown
 * read's own server read time less HEADER_SLACK_MS (2 s), whatever this browser's wall clock
 * does and however late the answer arrives (`serve.by` is no earlier than the true serve, and
 * the shown read time is at most 2 s past its arrival, by its Date cap). Measured over 120,000
 * simulated visits (discord-presence-property.test.ts). It reaches lower only when a server's
 * clock is off: the shown answer's ahead (what the bound is for: honest answers then show at
 * once), or this answer's behind, when a copy older by up to that lag can show for one poll.
 *
 * Without a monotonic reading for both, or without a Date on this answer (this browser's clock
 * then stands in for the server's), the shown read's own time is the bound.
 */
function shownReadBy(
  serverReadAt: number,
  arrivedMono: number | undefined,
  serve: Serve,
  sentMono: number | undefined,
): number {
  if (sentMono === undefined || arrivedMono === undefined) return serverReadAt;
  return Math.min(serverReadAt, serve.by - (sentMono - arrivedMono));
}

/**
 * Whether an answer read at `at` (the server's word) and served as `serve` leaves `shown` as it
 * is: it is the very read shown, or one made no later. Both reads are compared by the server's
 * clock, each no later than its own server says it served it, and the shown one no later than
 * shownReadBy allows.
 */
function keepsShown(
  at: number,
  serve: Serve,
  shown: DatedPresence,
  sentMono: number | undefined,
): boolean {
  const { statedAt, serverReadAt, arrivedMono } = shown;
  if (statedAt === undefined || serverReadAt === undefined) return false;
  if (at === statedAt) return true;
  return Math.min(at, serve.by) <= shownReadBy(serverReadAt, arrivedMono, serve, sentMono);
}

/**
 * `shown`, kept by an answer that arrived at `receivedAt` (`receivedMono` by the monotonic
 * clock), with its moments carried onto this browser's wall clock as it reads now. The wall clock
 * may have stepped since `shown` arrived (moved further than the monotonic clock counted); its
 * moments then move by the same step, so the age line keeps the read's true age instead of
 * adding the step (a forward step read 'updated 10 min ago' for a read 30 s old) or running into
 * the clock's future (a step back left the line with no words). Unchanged, and the very same
 * object, without a step or without monotonic readings.
 */
function onThisClock(
  shown: DatedPresence,
  receivedAt: number,
  receivedMono: number | undefined,
): DatedPresence {
  if (receivedMono === undefined || shown.arrivedMono === undefined) return shown;
  const step = receivedAt - shown.arrivedAt - (receivedMono - shown.arrivedMono);
  if (Math.abs(step) < CLOCK_STEP_MS) return shown;
  return { ...shown, readAt: shown.readAt + step, arrivedAt: shown.arrivedAt + step };
}

/**
 * What the tile shows once a poll's answer `json` arrives at `receivedAt` (this browser's clock),
 * after `shown`. `servedAt` is when the server served it by its own clock (its Date plus Age),
 * undefined when the response did not say. `times` are the poll's request and arrival by the
 * monotonic clock; the tile always passes them.
 *
 * The route answers from a cache (a minute, up to five while Lanyard fails): each server instance
 * holds its own copy, and on the live site Vercel's CDN keeps one too (its Date is the origin's,
 * its Age the seconds it held it; see servedAtOf). An answer can be older than the moment it
 * arrived, and older than the presence on screen. Such an answer keeps `shown`: the newer presence stays,
 * and its age keeps counting from its own read. Showing it would put an older status back over a
 * newer one. Two cases keep `shown` (keepsShown):
 * - the very read shown, again (the same `read_at`, as the server gave both), so a read the
 *   route repeats never restarts its age;
 * - an answer read no later than what is shown, both by the server's clock. A `read_at` later
 *   than the server says it served the answer (a clock stepped back after the read, or ahead of
 *   the Date) counts as read when it was served, so it holds back no answer read after that.
 * A kept presence is carried onto this browser's wall clock should it have stepped since
 * (onThisClock), so its age line keeps the read's true age.
 *
 * Any other answer is shown, dated for its age line by its arrival less its age when served
 * (DatedPresence.readAt); one that does not say when it was read (or says it in seconds) by its
 * arrival, the best this browser knows. A `shown` dated that way is no read time to compare
 * with, so the next answer is shown whatever it says.
 *
 * For an answer with a Date, no step compares a server time with a time on this browser's wall
 * clock, and the time since the shown answer arrived is counted by the monotonic clock from this
 * request's start, so neither a wall clock off the server's nor a step of it between polls, nor
 * an answer slow to arrive, changes which read shows (shownReadBy). The Date is whole seconds:
 * reads are ordered by `read_at` in milliseconds, and the Date only caps a `read_at` more than
 * 2 s past it, so two reads less than a second apart keep their order; the age line may be up to
 * that second (and the request's latency) young. Without a Date this browser's clock stands in
 * for the server's, as before: by a clock behind, an older copy read less than that offset
 * before what is shown is shown.
 *
 * @throws {LiveResponseError} For an answer of the wrong shape, whatever it says of its read.
 */
export function presenceAfterPoll(
  json: unknown,
  receivedAt: number,
  shown?: DatedPresence,
  servedAt?: number,
  times?: PollTimes,
): DatedPresence {
  const presence = parseLanyard(json);
  const at = statedReadAt(json);
  const arrivedMono = times?.received;
  if (at === undefined) {
    return withMono({ presence, readAt: receivedAt, arrivedAt: receivedAt }, arrivedMono);
  }
  const serve = serveOf(receivedAt, servedAt, HEADER_SLACK_MS);
  const sentMono = servedAt === undefined ? undefined : times?.sent;
  if (shown && keepsShown(at, serve, shown, sentMono)) {
    return onThisClock(shown, receivedAt, arrivedMono);
  }
  return datedBy(presence, at, receivedAt, serve, arrivedMono);
}

/** The avatar on Discord's CDN at 96 px (48 px at 2x); undefined without an avatar hash. */
export function avatarUrl(user: LanyardData['discord_user']): string | undefined {
  if (!user.avatar) return undefined;
  const id = encodeURIComponent(user.id);
  return `https://cdn.discordapp.com/avatars/${id}/${encodeURIComponent(user.avatar)}.png?size=96`;
}

/** The profile page Discord opens for a user id. */
export const profileUrl = (id: string): string =>
  `https://discord.com/users/${encodeURIComponent(id)}`;

/**
 * The order rows are shown in: what's playing in the owner's ears first, then the rest. Custom
 * status (4) is a profile note, not an activity, so it is left out.
 */
const DISPLAY_ORDER: readonly number[] = [
  ActivityType.Listening,
  ActivityType.Playing,
  ActivityType.Streaming,
  ActivityType.Watching,
  ActivityType.Competing,
];

const VERBS: Readonly<Record<number, string>> = {
  [ActivityType.Playing]: 'Playing',
  [ActivityType.Streaming]: 'Streaming',
  [ActivityType.Listening]: 'Listening to',
  [ActivityType.Watching]: 'Watching',
  [ActivityType.Competing]: 'Competing in',
};

/** Most rows the tile shows, so a busy presence doesn't stretch it. */
export const MAX_ACTIVITY_ROWS = 3;

/**
 * The activities worth showing, most relevant first: listening, then playing, streaming, watching
 * and competing. Activities of the same type keep Discord's order.
 */
export function selectActivities<T extends PresenceActivity>(
  activities: readonly T[] | undefined,
): T[] {
  return (activities ?? [])
    .filter((activity) => DISPLAY_ORDER.includes(activity.type))
    .sort((a, b) => DISPLAY_ORDER.indexOf(a.type) - DISPLAY_ORDER.indexOf(b.type));
}

/** "Listening to Spotify", "Playing Visual Studio Code", "Watching YouTube". */
export const activityHeading = (activity: PresenceActivity): string =>
  `${VERBS[activity.type] ?? 'Playing'} ${activity.name}`;

export const isListening = (activity: PresenceActivity): boolean =>
  activity.type === ActivityType.Listening;

const SPOTIFY_ART_PREFIX = 'spotify:';
const SPOTIFY_IMAGE_ID = /^[A-Za-z0-9]+$/;

/**
 * Lanyard sends Spotify album art as `spotify:<image id>`; the image lives at
 * https://i.scdn.co/image/<image id>. Anything else (app assets, `mp:external/...`) is not
 * Spotify art and gets no image.
 */
export function spotifyArtUrl(largeImage: string | undefined): string | undefined {
  if (!largeImage?.startsWith(SPOTIFY_ART_PREFIX)) return undefined;
  const id = largeImage.slice(SPOTIFY_ART_PREFIX.length);
  return SPOTIFY_IMAGE_ID.test(id) ? `https://i.scdn.co/image/${id}` : undefined;
}

/**
 * `value` as an https URL on `hostname`, or undefined. Keeps next/image to the hosts next.config
 * allows and keeps links pointed at Spotify.
 */
export function httpsUrlOn(value: string | undefined, hostname: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Which glyph a row without art gets. */
export type ActivityKind = 'spotify' | 'code' | 'other';

/** One row of the activity list. */
export interface ActivityRow {
  readonly key: string;
  readonly kind: ActivityKind;
  readonly heading: string;
  readonly primary?: string;
  readonly secondary?: string;
  readonly art?: { readonly src: string; readonly alt: string };
  /** Present for rows that link out; `label` is then the link's accessible name. */
  readonly link?: { readonly href: string; readonly label: string };
}

const SPOTIFY_ART_HOST = 'i.scdn.co';
const SPOTIFY_LINK_HOST = 'open.spotify.com';
const NEW_TAB = '(opens in a new tab)';

/** A Spotify activity gets the headphones, VS Code its editor glyph, the rest a pulse line. */
function kindOf(name: string): ActivityKind {
  const lower = name.toLowerCase();
  if (lower.includes('spotify')) return 'spotify';
  if (lower.includes('visual studio code')) return 'code';
  return 'other';
}

/** A Discord activity as a row; album art only from Spotify's `spotify:<id>` assets. */
function fromDiscord(activity: PresenceActivity, index: number): ActivityRow {
  const artSrc = spotifyArtUrl(activity.assets?.large_image);
  const artSubject = activity.assets?.large_text ?? activity.details;
  return defined<ActivityRow>({
    key: `discord-${index}-${activity.type}-${activity.name}`,
    kind: kindOf(activity.name),
    heading: activityHeading(activity),
    primary: activity.details,
    secondary: activity.state,
    art: artSrc
      ? { src: artSrc, alt: artSubject ? `Album art for ${artSubject}` : 'Album art' }
      : undefined,
  });
}

/** Spotify's now playing as a row, linked to the track when Spotify gave its page. */
function fromNowPlaying({
  songName,
  artistName,
  imageURL,
  songURL,
}: NowPlayingResponse): ActivityRow {
  const heading = 'Listening on Spotify';
  const artSrc = httpsUrlOn(imageURL, SPOTIFY_ART_HOST);
  const href = httpsUrlOn(songURL, SPOTIFY_LINK_HOST);
  const track = [songName, artistName && `by ${artistName}`].filter(Boolean).join(' ');
  return defined<ActivityRow>({
    key: 'spotify-now-playing',
    kind: 'spotify',
    heading,
    primary: songName,
    secondary: artistName,
    art: artSrc
      ? { src: artSrc, alt: songName ? `Album art for ${songName}` : 'Album art' }
      : undefined,
    link: href ? { href, label: `${heading}${track ? `: ${track}` : ''} ${NEW_TAB}` } : undefined,
  });
}

/**
 * The rows to show: Spotify's now playing first when Discord reports no listening and Spotify
 * says a track is playing, then Discord's activities in display order; at most
 * {@link MAX_ACTIVITY_ROWS}.
 */
export function activityRows(
  activities: readonly PresenceActivity[] | undefined,
  nowPlaying: NowPlayingResponse | undefined,
): ActivityRow[] {
  const shown = selectActivities(activities);
  const fallback =
    !shown.some(isListening) && nowPlaying?.isPlaying ? [fromNowPlaying(nowPlaying)] : [];
  return [...fallback, ...shown.map(fromDiscord)].slice(0, MAX_ACTIVITY_ROWS);
}
