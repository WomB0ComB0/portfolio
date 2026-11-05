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

import { Schema } from 'effect';

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

export const ActivitySchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Number,
  state: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
  application_id: Schema.optional(Schema.String),
  assets: Schema.optional(
    Schema.Struct({
      large_image: Schema.optional(Schema.String),
      large_text: Schema.optional(Schema.String),
    }),
  ),
});

export type DiscordActivity = Schema.Schema.Type<typeof ActivitySchema>;

/** The site's own Spotify endpoint, /api/v1/now-playing. */
export const NowPlayingSchema = Schema.Struct({
  isPlaying: Schema.Boolean,
  songName: Schema.optional(Schema.String),
  artistName: Schema.optional(Schema.String),
  songURL: Schema.optional(Schema.String),
  imageURL: Schema.optional(Schema.String),
});

export type NowPlaying = Schema.Schema.Type<typeof NowPlayingSchema>;

/**
 * The order rows are shown in: what's playing in the owner's ears first, then the rest.
 * Custom status (4) is a profile note, not an activity, so it is left out.
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

/** Most rows the card shows, so a busy presence doesn't stretch the sidebar column. */
export const MAX_ACTIVITY_ROWS = 3;

/**
 * The activities worth showing, most relevant first: listening, then playing, streaming,
 * watching and competing. Activities of the same type keep Discord's order.
 */
export const selectActivities = (
  activities: readonly DiscordActivity[] | undefined,
): DiscordActivity[] =>
  (activities ?? [])
    .filter((activity) => DISPLAY_ORDER.includes(activity.type))
    .sort((a, b) => DISPLAY_ORDER.indexOf(a.type) - DISPLAY_ORDER.indexOf(b.type));

/** "Listening to Spotify", "Playing Visual Studio Code", "Watching YouTube". */
export const activityHeading = (activity: DiscordActivity): string =>
  `${VERBS[activity.type] ?? 'Playing'} ${activity.name}`;

export const isListening = (activity: DiscordActivity): boolean =>
  activity.type === ActivityType.Listening;

const SPOTIFY_ART_PREFIX = 'spotify:';
const SPOTIFY_IMAGE_ID = /^[A-Za-z0-9]+$/;

/**
 * Lanyard sends Spotify album art as `spotify:<image id>`; the image lives at
 * https://i.scdn.co/image/<image id>. Anything else (app assets, `mp:external/...`) is not
 * Spotify art and gets no image.
 */
export const spotifyArtUrl = (largeImage: string | undefined): string | undefined => {
  if (!largeImage?.startsWith(SPOTIFY_ART_PREFIX)) return undefined;
  const id = largeImage.slice(SPOTIFY_ART_PREFIX.length);
  return SPOTIFY_IMAGE_ID.test(id) ? `https://i.scdn.co/image/${id}` : undefined;
};

/**
 * `value` as an https URL on `hostname`, or undefined. Keeps next/image to the hosts
 * next.config allows and keeps links pointed at Spotify.
 */
export const httpsUrlOn = (value: string | undefined, hostname: string): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
};
