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
 * @file The console Discord tile's album art: a row whose art fails to load falls back to the
 * glyph tile a row without art shows, never a broken image.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => {
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_DISCORD_ID: '42' };
  return { env, default: env };
});

import { DiscordTile } from '@/app/(routes)/(dev)/stats/_components/console/discord-tile';

const ART_ALT = 'Album art for Going to a Go-Go';

const listening = {
  name: 'Spotify',
  type: 2,
  details: 'Ooo Baby Baby',
  state: 'Smokey Robinson & The Miracles',
  assets: { large_image: 'spotify:ab67616d0000b273', large_text: 'Going to a Go-Go' },
};

function tile(): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchedAt = Date.now();
  return (
    <QueryClientProvider client={client}>
      <DiscordTile
        profileId="42"
        renderedAt={fetchedAt}
        nowPlaying={{ kind: 'data', data: { isPlaying: false }, fetchedAt }}
        initial={{
          kind: 'data',
          fetchedAt,
          data: {
            discord_status: 'online',
            discord_user: { username: 'womb0.comb0', discriminator: '0', avatar: '', id: '42' },
            activities: [listening],
          },
        }}
      />
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe('Discord tile album art', () => {
  it('shows the art while it loads, with no glyph beside it', () => {
    const { container } = render(tile());

    expect(container.querySelector(`img[alt="${ART_ALT}"]`)).not.toBeNull();
    expect(container.querySelector('[data-row-glyph]')).toBeNull();
  });

  it('falls back to the glyph tile when the art fails to load', () => {
    const { container } = render(tile());
    const art = container.querySelector(`img[alt="${ART_ALT}"]`);
    if (!art) throw new Error('the row must start with its art');

    fireEvent.error(art);

    expect(container.querySelector(`img[alt="${ART_ALT}"]`)).toBeNull();
    expect(container.querySelector('[data-row-glyph] svg')).not.toBeNull();
    expect(container.textContent).toContain('Ooo Baby Baby');
  });
});
