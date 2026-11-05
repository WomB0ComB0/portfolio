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

/** @file Picking and wording the Discord card's activities, and the Spotify URLs it trusts. */

import { describe, expect, it } from 'vitest';
import {
  activityHeading,
  type DiscordActivity,
  httpsUrlOn,
  selectActivities,
  spotifyArtUrl,
} from '@/app/(routes)/(dev)/stats/_components/discord-activity.utils';

const activity = (type: number, name: string): DiscordActivity => ({ type, name });

describe('selectActivities', () => {
  it('drops custom status and puts listening first, then playing, streaming, watching, competing', () => {
    const input = [
      activity(5, 'Ranked'),
      activity(3, 'YouTube'),
      activity(4, 'Custom Status'),
      activity(0, 'Visual Studio Code'),
      activity(1, 'Twitch'),
      activity(2, 'Spotify'),
    ];

    expect(selectActivities(input).map((a) => a.name)).toEqual([
      'Spotify',
      'Visual Studio Code',
      'Twitch',
      'YouTube',
      'Ranked',
    ]);
    // The Lanyard array is left as it came.
    expect(input[0]?.name).toBe('Ranked');
  });

  it('keeps Discord order within a type, and leaves out unknown types', () => {
    expect(
      selectActivities([activity(0, 'First'), activity(9, 'Future'), activity(0, 'Second')]).map(
        (a) => a.name,
      ),
    ).toEqual(['First', 'Second']);
  });

  it('handles a missing activities array', () => {
    expect(selectActivities(undefined)).toEqual([]);
  });
});

describe('activityHeading', () => {
  it.each([
    [0, 'Visual Studio Code', 'Playing Visual Studio Code'],
    [1, 'Twitch', 'Streaming Twitch'],
    [2, 'Spotify', 'Listening to Spotify'],
    [3, 'YouTube', 'Watching YouTube'],
    [5, 'Ranked', 'Competing in Ranked'],
  ])('type %i "%s" reads "%s"', (type, name, heading) => {
    expect(activityHeading(activity(type, name))).toBe(heading);
  });
});

describe('spotifyArtUrl', () => {
  it("maps Lanyard's spotify:<id> to the i.scdn.co image", () => {
    expect(spotifyArtUrl('spotify:ab67616d0000b273abc')).toBe(
      'https://i.scdn.co/image/ab67616d0000b273abc',
    );
  });

  it.each([
    undefined,
    '',
    'mp:external/abc/https/example.com/a.png',
    '1234567890',
    'spotify:',
    'spotify:../../evil',
    'spotify:abc?x=1',
  ])('gives no image for %j', (value) => {
    expect(spotifyArtUrl(value)).toBeUndefined();
  });
});

describe('httpsUrlOn', () => {
  it('accepts an https URL on the given host', () => {
    expect(httpsUrlOn('https://open.spotify.com/track/1', 'open.spotify.com')).toBe(
      'https://open.spotify.com/track/1',
    );
  });

  it.each([
    undefined,
    'not a url',
    'http://open.spotify.com/track/1',
    'https://open.spotify.com.evil.example/track/1',
    'javascript:alert(1)',
  ])('rejects %j', (value) => {
    expect(httpsUrlOn(value, 'open.spotify.com')).toBeUndefined();
  });
});
