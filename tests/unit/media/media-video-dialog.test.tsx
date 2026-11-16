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
 * @file The /media embed option (media-play=embed): a plain click on a video's link opens the
 * in-page player (youtube-nocookie, autoplay, titled for the video, with a way out to YouTube),
 * Escape closes it; a modified click and every visit in link mode keep the link's own behaviour.
 * A CSP block on the frame turns into a designed note instead of the browser's broken frame.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { makeVideo } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { describe, expect, it } from 'vitest';
import { MediaFeedView } from '@/app/(routes)/(dev)/media/_interface/media-feed/media-feed';
import { buildFeed, type FeedEntry } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import type { PlayMode } from '@/app/(routes)/(dev)/media/_lib/media-options';

const ENTRIES: readonly FeedEntry[] = buildFeed(
  {
    videos: [
      makeVideo({
        title: 'Cloud demo',
        videoId: 'cloud000001',
        publishedDate: '2025-10-10T00:00:00Z',
      }),
    ],
  },
  () => null,
);

function renderFeed(play: PlayMode): void {
  render(
    <NuqsTestingAdapter>
      <MediaFeedView
        feed={{ entries: ENTRIES, missing: [] }}
        parts="fold"
        play={play}
        path="/media"
      />
    </NuqsTestingAdapter>,
  );
}

const titleLink = (): HTMLElement => screen.getByRole('link', { name: /Cloud demo/ });

describe('media-play=embed', () => {
  it('opens the in-page player on a plain click, titled for the video', async () => {
    renderFeed('embed');

    fireEvent.click(titleLink());

    const dialog = await screen.findByRole('dialog', { name: 'Cloud demo' });
    const frame = dialog.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/cloud000001?autoplay=1&rel=0',
    );
    expect(frame?.getAttribute('title')).toBe('Cloud demo, on YouTube');
    expect(screen.getByRole('link', { name: /Watch on YouTube/ }).getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=cloud000001',
    );
  });

  // The frame gets what playback needs and nothing else: no motion sensors, clipboard or share
  // sheet, and a sandbox that never lets it navigate this page (no allow-top-navigation).
  it('asks only for what playback needs, inside a sandbox that keeps it off this page', async () => {
    renderFeed('embed');

    fireEvent.click(titleLink());

    const dialog = await screen.findByRole('dialog', { name: 'Cloud demo' });
    const frame = dialog.querySelector('iframe');
    const allowed = (frame?.getAttribute('allow') ?? '').split(';').map((each) => each.trim());
    const sandbox = (frame?.getAttribute('sandbox') ?? '').split(' ').filter(Boolean);
    expect(allowed.sort()).toEqual([
      'autoplay',
      'encrypted-media',
      'fullscreen',
      'picture-in-picture',
    ]);
    expect(sandbox.sort()).toEqual([
      'allow-popups',
      'allow-popups-to-escape-sandbox',
      'allow-presentation',
      'allow-same-origin',
      'allow-scripts',
    ]);
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
  });

  it('closes on Escape and gives focus back to the link', async () => {
    renderFeed('embed');
    const link = titleLink();
    link.focus();
    fireEvent.click(link);
    const dialog = await screen.findByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(link));
  });

  it('leaves a modified click to the browser (a new tab), opening nothing', async () => {
    renderFeed('embed');

    const followed = fireEvent.click(titleLink(), { ctrlKey: true });

    expect(followed).toBe(true);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says the frame is blocked, with the link out, when the CSP refuses it', async () => {
    renderFeed('embed');
    fireEvent.click(titleLink());
    await screen.findByRole('dialog');

    act(() => {
      document.dispatchEvent(
        Object.assign(new Event('securitypolicyviolation'), {
          violatedDirective: 'frame-src',
          effectiveDirective: 'frame-src',
          blockedURI: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    expect(await screen.findByText("This video can't play here yet.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /watch it on YouTube/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=cloud000001',
    );
    expect(screen.queryByText(/frame-src/)).not.toBeInTheDocument();
  });

  it('does not promise playback once blocked, and ends its sentence without a stray space', async () => {
    renderFeed('embed');
    fireEvent.click(titleLink());
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Plays here from YouTube, privacy-enhanced.');

    act(() => {
      document.dispatchEvent(
        Object.assign(new Event('securitypolicyviolation'), {
          violatedDirective: 'frame-src',
          effectiveDirective: 'frame-src',
          blockedURI: 'https://www.youtube-nocookie.com',
        }),
      );
    });

    const link = await screen.findByRole('link', { name: /watch it on YouTube/ });
    expect(dialog.textContent).not.toContain('Plays here from YouTube');
    expect(dialog.textContent).toContain("From YouTube. This site's settings block the player.");
    expect(link).toHaveAccessibleName('watch it on YouTube (opens in a new tab)');
    expect(link.textContent).toBe('watch it on YouTube');
    expect(link.parentElement?.textContent).toBe('You can still watch it on YouTube.');
  });

  it('lets a long title wrap and keeps the keyboard hint off touch screens', async () => {
    renderFeed('embed');
    fireEvent.click(titleLink());
    const dialog = await screen.findByRole('dialog');

    const title = within(dialog).getByRole('heading', { name: 'Cloud demo' });
    expect(title.className.split(' ')).toContain('line-clamp-2');
    expect(title.className.split(' ')).not.toContain('truncate');
    expect(within(dialog).getByText('Esc closes').className).toContain(
      '[@media(pointer:coarse)]:hidden',
    );
  });

  it("asks for YouTube's large still and falls back to the small one when there is none", async () => {
    renderFeed('embed');
    fireEvent.click(titleLink());
    const dialog = await screen.findByRole('dialog');
    const poster = (): HTMLImageElement | null => dialog.querySelector('img');

    expect(decodeURIComponent(poster()?.getAttribute('src') ?? '')).toContain(
      'cloud000001/maxresdefault.jpg',
    );
    const first = poster();
    if (first) fireEvent.error(first);

    expect(decodeURIComponent(poster()?.getAttribute('src') ?? '')).toContain(
      'cloud000001/hqdefault.jpg',
    );
  });
});

describe('media-play=link', () => {
  it('follows the link: no player, no prevented click', async () => {
    renderFeed('link');

    const followed = fireEvent.click(titleLink());

    expect(followed).toBe(true);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
