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
 * @file YouTube ids read out of links and text (src/lib/youtube/video-id.ts): the link forms a
 * video id is read from, the look-alikes it is not, and every id in a post body, in order, each
 * once. /media pairs a post with the video it embeds through these, so a wrong id would invent a
 * pair.
 */

import { describe, expect, it } from 'vitest';
import { youtubeIdsIn, youtubeVideoIdOf } from '@/lib/youtube/video-id';

const ID = 'DOtNqJyanOA';

describe('youtubeVideoIdOf', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`],
    [`https://youtu.be/${ID}?si=abc`],
    [`https://www.youtube.com/embed/${ID}?rel=0`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?feature=share`],
    [`youtu.be/${ID}`],
    [`  https://www.youtube.com/watch?v=${ID}#t=1  `],
  ])('reads the id in %s', (link) => {
    expect(youtubeVideoIdOf(link)).toBe(ID);
  });

  it.each([
    ['https://www.youtube.com/@someone'],
    ['https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'],
    ['https://www.youtube.com/playlist?list=PL1234567890'],
    ['https://www.youtube.com/watch?v=short'],
    [`https://www.youtube.com/watch?list=${ID}`],
    [`https://notyoutube.com/watch?v=${ID}`],
    [`https://youtube.com.evil.example/watch?v=${ID}`],
    [`https://vimeo.com/${ID}`],
    [`https://blog.example.dev/?u=https://youtu.be/${ID}`],
    [''],
    ['not a link'],
  ])('reads no id in %s', (link) => {
    expect(youtubeVideoIdOf(link)).toBeNull();
  });
});

describe('youtubeIdsIn', () => {
  it('finds every id in a post body, in order, each once', () => {
    const body = `
      <p>Watch <a href="https://youtu.be/aaaaaaaaaa1">part one</a>.</p>
      <iframe src="//www.youtube-nocookie.com/embed/bbbbbbbbbb2?rel=0"></iframe>
      <a class="embed-card" href="https://www.youtube.com/watch?v=aaaaaaaaaa1">https://www.youtube.com/watch?v=aaaaaaaaaa1</a>
      <p>and https://www.youtube.com/watch?v=cccccccccc3, the last.</p>`;

    expect(youtubeIdsIn(body)).toEqual(['aaaaaaaaaa1', 'bbbbbbbbbb2', 'cccccccccc3']);
  });

  it('decodes &amp; before it reads a link', () => {
    expect(
      youtubeIdsIn(`<a href="https://www.youtube.com/watch?list=PL1&amp;v=${ID}">x</a>`),
    ).toEqual([ID]);
  });

  it('stops at the cap', () => {
    const body = Array.from(
      { length: 30 },
      (_, n) => `https://youtu.be/video0000${String(n).padStart(2, '0')}`,
    );

    expect(youtubeIdsIn(body.join(' '))).toHaveLength(20);
    expect(youtubeIdsIn(body.join(' '), 3)).toEqual(['video000000', 'video000001', 'video000002']);
  });

  it('finds nothing in text without a YouTube video link', () => {
    expect(youtubeIdsIn('')).toEqual([]);
    expect(
      youtubeIdsIn('<p>See https://www.youtube.com/@someone and https://example.com/a</p>'),
    ).toEqual([]);
  });

  it('trims a run of closing punctuation after a link, and keeps the id', () => {
    expect(youtubeIdsIn(`(see https://youtu.be/${ID})].,;:!?} and more`)).toEqual([ID]);
    expect(youtubeIdsIn(`https://www.youtube.com/watch?v=${ID}&t=1).`)).toEqual([ID]);
  });

  /**
   * A post body is not capped: one link with a 100,000-character run cost five to six seconds per
   * feed build while the trim was a '+$' pattern (each start in the run re-scanned it). It is a
   * loop now, so the time grows with the text, not its square.
   */
  it.each([
    ['full stops inside', `https://x.dev/${'.'.repeat(100_000)}a`, []],
    ['closing brackets inside', `https://x.dev/${')'.repeat(100_000)}a`, []],
    ['closers after a video link', `https://youtu.be/${ID}${').'.repeat(50_000)}`, [ID]],
  ])('reads a link with %s of 100,000 characters fast', (_case, body, ids) => {
    const FAST_MS = 250;
    const start = performance.now();
    const found = youtubeIdsIn(body);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(found).toEqual(ids);
  });
});
