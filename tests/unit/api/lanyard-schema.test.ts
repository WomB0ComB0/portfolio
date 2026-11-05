// @vitest-environment node
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

/**
 * @file /api/v1/lanyard keeps each activity's art. Two layers decide what reaches the /stats card:
 * the handler's Effect schema (which drops unknown keys when it decodes Lanyard's reply) and the
 * Elysia response model (which strips unknown keys before sending). Both must keep `assets`, and a
 * missing or null asset field must never fail validation, which would show the card's error state.
 */

import { Elysia } from 'elysia';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { lanyardSchema } from '@/app/api/v1/[[...route]]/lanyard/schema';

/** The handler caches Lanyard's reply for a minute, so each test loads a fresh copy of it. */
const loadGetLanyardData = async () => {
  vi.resetModules();
  return (await import('@/app/api/v1/[[...route]]/lanyard/handlers')).getLanyardData;
};

const lanyardReply = (data: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );

const SPOTIFY_ART = 'spotify:ab67616d0000b27372d5adcdef5c335651d067aa';

const discordUser = { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' };

const spotifyActivity = {
  name: 'Spotify',
  type: 2,
  details: 'My War',
  state: 'Miura Jam',
  assets: { large_image: SPOTIFY_ART, large_text: 'My War (Attack on Titan)' },
};

/** A bare app with the real lanyard models, answering whatever the test hands it. */
const serve = (payload: unknown) =>
  new Elysia()
    .model(lanyardSchema)
    .get('/', () => payload as never, { response: { 200: 'lanyard.response' } })
    .handle(new Request('http://localhost/'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lanyard.response', () => {
  it('keeps activity assets', async () => {
    const res = await serve({
      discord_user: discordUser,
      activities: [{ ...spotifyActivity, assets: { ...spotifyActivity.assets, small_image: 'x' } }],
      discord_status: 'online',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities[0]).toEqual(spotifyActivity);
  });

  it('accepts activities with no assets, or assets with no large image', async () => {
    const res = await serve({
      discord_user: discordUser,
      activities: [
        { name: 'Custom Status', type: 4 },
        { name: 'Visual Studio Code', type: 0, assets: { small_text: 'TypeScript' } },
      ],
      discord_status: 'dnd',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).activities).toEqual([
      { name: 'Custom Status', type: 4 },
      { name: 'Visual Studio Code', type: 0, assets: {} },
    ]);
  });
});

describe('getLanyardData', () => {
  it("keeps the assets from Lanyard's reply and drops null asset fields", async () => {
    vi.stubGlobal(
      'fetch',
      lanyardReply({
        discord_user: { ...discordUser, global_name: 'Tester' },
        activities: [
          { ...spotifyActivity, id: 'spotify:1', sync_id: '3jWNreHk8zyP5KUHyuoXf1' },
          { name: 'Some Game', type: 0, assets: { large_image: null, large_text: null } },
        ],
        discord_status: 'online',
        listening_to_spotify: true,
      }),
    );
    const getLanyardData = await loadGetLanyardData();

    const data = await getLanyardData();

    expect(data.activities).toEqual([spotifyActivity, { name: 'Some Game', type: 0, assets: {} }]);
  });

  it('accepts a null state or details, which Discord documents as nullable', async () => {
    vi.stubGlobal(
      'fetch',
      lanyardReply({
        discord_user: discordUser,
        activities: [{ name: 'Some Game', type: 0, state: null, details: null }],
        discord_status: 'online',
      }),
    );
    const getLanyardData = await loadGetLanyardData();

    expect((await getLanyardData()).activities).toEqual([{ name: 'Some Game', type: 0 }]);
  });

  it('accepts a null assets object from Lanyard', async () => {
    vi.stubGlobal(
      'fetch',
      lanyardReply({
        discord_user: discordUser,
        activities: [{ name: 'Some Game', type: 0, assets: null }],
        discord_status: 'online',
      }),
    );
    const getLanyardData = await loadGetLanyardData();

    expect((await getLanyardData()).activities).toEqual([{ name: 'Some Game', type: 0 }]);
  });

  it("passes the example reply from Lanyard's README through the handler and the route", async () => {
    // https://github.com/Phineas/lanyard#getting-a-users-presence-data (Spotify + VS Code)
    vi.stubGlobal(
      'fetch',
      lanyardReply({
        active_on_discord_mobile: false,
        active_on_discord_desktop: true,
        listening_to_spotify: true,
        kv: { location: 'Los Angeles, CA' },
        spotify: {
          track_id: '3kdlVcMVsSkbsUy8eQcBjI',
          timestamps: { start: 1615529820677, end: 1615530068733 },
          song: 'Let Go',
          artist: 'Ark Patrol; Veronika Redd',
          album_art_url: 'https://i.scdn.co/image/ab67616d0000b27364840995fe43bb2ec73a241d',
          album: 'Let Go',
        },
        discord_user: {
          username: 'Phineas',
          public_flags: 131584,
          id: '94490510688792576',
          discriminator: '0001',
          avatar: 'a_7484f82375f47a487f41650f36d30318',
        },
        discord_status: 'online',
        activities: [
          {
            type: 2,
            timestamps: { start: 1615529820677, end: 1615530068733 },
            sync_id: '3kdlVcMVsSkbsUy8eQcBjI',
            state: 'Ark Patrol; Veronika Redd',
            session_id: '140ecdfb976bdbf29d4452d492e551c7',
            party: { id: 'spotify:94490510688792576' },
            name: 'Spotify',
            id: 'spotify:1',
            flags: 48,
            details: 'Let Go',
            created_at: 1615529838051,
            assets: {
              large_text: 'Let Go',
              large_image: 'spotify:ab67616d0000b27364840995fe43bb2ec73a241d',
            },
          },
          {
            type: 0,
            timestamps: { start: 1615438153941 },
            state: 'Workspace: lanyard',
            name: 'Visual Studio Code',
            id: '66b84f5317e9de6c',
            details: 'Editing README.md',
            created_at: 1615529838050,
            assets: {
              small_text: 'Visual Studio Code',
              small_image: '565945770067623946',
              large_text: 'Editing a MARKDOWN file',
              large_image: '565945077491433494',
            },
            application_id: '383226320970055681',
          },
        ],
        active_on_discord_web: false,
      }),
    );
    const getLanyardData = await loadGetLanyardData();

    const res = await serve(await getLanyardData());

    expect(res.status).toBe(200);
    expect((await res.json()).activities).toEqual([
      {
        name: 'Spotify',
        type: 2,
        state: 'Ark Patrol; Veronika Redd',
        details: 'Let Go',
        assets: {
          large_text: 'Let Go',
          large_image: 'spotify:ab67616d0000b27364840995fe43bb2ec73a241d',
        },
      },
      {
        name: 'Visual Studio Code',
        type: 0,
        state: 'Workspace: lanyard',
        details: 'Editing README.md',
        assets: { large_text: 'Editing a MARKDOWN file', large_image: '565945077491433494' },
      },
    ]);
  });
});
