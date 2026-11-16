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
 * @file /spotify's small accessibility and state rules, read from the server HTML: one spoken
 * hero state, a moving placeholder while a coverless track plays, a spoken album dash, and the
 * phone's meta line in reading order.
 *
 * How the page lays out with text enlarged (the header's figures, the hero's height in every
 * state, ranks, covers, titles that wrap with their arrow, artist cards and long names) is
 * measured in a browser by e2e/journeys/spotify.spec.ts: jsdom lays nothing out, so class names
 * here could not show it.
 */

import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The app's PostCSS config cannot run in Vitest; this matches the home tile's CSS stub.
vi.mock('@/app/_components/home/live/equaliser.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? `eq-${name}` : undefined) },
  ),
}));

import type { PlayingTrackView } from '@/app/_components/home/live/now-playing-view';
import { HeroView } from '@/app/(routes)/(main)/(personal)/spotify/_components/hero-view';
import { TrackTable } from '@/app/(routes)/(main)/(personal)/spotify/_components/track-table';
import type {
  ChartListResult,
  ChartTrack,
} from '@/app/(routes)/(main)/(personal)/spotify/_lib/chart';
import type { HeroState } from '@/app/(routes)/(main)/(personal)/spotify/_lib/hero-state';

const SEEN_AT = 1_700_000_000_000;

const TRACK_VIEW: PlayingTrackView = {
  kind: 'playing',
  title: 'Sample song',
  subtitle: 'Sample artist',
  spokenSuffix: 'by Sample artist on Spotify',
  href: 'https://open.spotify.com/track/sample',
  imageURL: 'https://i.scdn.co/image/sample-album',
};

const track = (overrides: Partial<ChartTrack> = {}): ChartTrack => ({
  rank: 1,
  key: 'one',
  title: 'First Song',
  artist: 'Singer One',
  artists: ['Singer One'],
  album: 'First Album',
  duration: '3:05',
  durationIso: 'PT3M5S',
  durationMs: 185_000,
  href: 'https://open.spotify.com/track/one',
  art: 'https://i.scdn.co/image/one',
  ...overrides,
});

const TRACKS: ChartListResult<ChartTrack> = {
  status: 'ok',
  data: [track(), track({ rank: 2, key: 'two', album: undefined, art: undefined })],
};

/** Server HTML parsed into a detached element. */
function html(node: ReactElement): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = renderToString(node);
  return root;
}

/** What a screen reader hears: the text without anything hidden from assistive technology. */
function spokenText(element: Element | null | undefined): string {
  if (!element) return '';
  const clone = element.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const heroOf = (state: HeroState): HTMLElement => {
  const hero = html(<HeroView state={state} />).querySelector<HTMLElement>('[data-spotify-hero]');
  if (!hero) throw new Error('no hero in the HTML');
  return hero;
};

describe('the /spotify hero, once per state', () => {
  it.each<[string, HeroState, string]>([
    ['playing', TRACK_VIEW, 'Playing now on Spotify'],
    ['playing-unknown', { kind: 'playing-unknown' }, 'Playing now on Spotify'],
  ])('announces the %s state once, in its visible label', (_name, state, spoken) => {
    const hero = heroOf(state);
    const headings = Array.from(hero.querySelectorAll('h2'));

    expect(headings).toHaveLength(1);
    expect(spokenText(headings[0])).toBe(spoken);
    // The heading is the label the eye reads too, not words for screen readers only.
    expect(headings[0]).toHaveAttribute('data-hero-label');
    expect(spokenText(hero).match(/Playing now/g)).toHaveLength(1);
  });

  it('announces "Recently played" once, with the age, in its visible label', () => {
    const hero = heroOf({ kind: 'recent', track: TRACK_VIEW, at: SEEN_AT });
    const headings = Array.from(hero.querySelectorAll('h2'));

    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAttribute('data-hero-label');
    expect(spokenText(headings[0])).toMatch(/^Recently played, /);
    expect(spokenText(hero).match(/Recently played/g)).toHaveLength(1);
  });

  it('moves the placeholder bars while a track without a cover plays, as the small bars do', () => {
    const hero = heroOf({ ...TRACK_VIEW, imageURL: undefined });
    const bars = Array.from(hero.querySelectorAll('[data-equaliser]'), (bar) =>
      bar.getAttribute('data-equaliser'),
    );

    expect(hero.querySelector('[data-art-glyph] [data-equaliser]')).toHaveAttribute(
      'data-equaliser',
      'live',
    );
    expect(bars).toEqual(['live', 'live']);
  });

  it('keeps both sets of bars still for a recently played track without a cover', () => {
    const hero = heroOf({
      kind: 'recent',
      track: { ...TRACK_VIEW, imageURL: undefined },
      at: SEEN_AT,
    });

    expect(
      Array.from(hero.querySelectorAll('[data-equaliser]'), (bar) =>
        bar.getAttribute('data-equaliser'),
      ),
    ).toEqual(['still', 'still']);
  });
});

describe('the /spotify track table', () => {
  const rows = () =>
    Array.from(html(<TrackTable result={TRACKS} />).querySelectorAll('[data-spotify-track]'));

  it('reads the phone meta line as the artist, then the length', () => {
    const meta = rows()[0]?.querySelector('[data-phone-meta]');

    expect(meta?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Singer One · 3:05');
  });

  it('says "Unknown album" for a track with no album, as the length cell does', () => {
    const album = rows()[1]?.querySelectorAll('td')[2];

    expect(spokenText(album)).toBe('Unknown album');
    expect(album?.querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
  });

  it('names each title link with its words and the new tab, and nothing else', () => {
    const link = rows()[0]?.querySelector('[data-track-title]');

    expect(spokenText(link)).toBe('First Song (opens in a new tab)');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
