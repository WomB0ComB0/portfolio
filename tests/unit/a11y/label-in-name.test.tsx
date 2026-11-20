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
 * @file The WCAG 2.5.3 helper (tests/utils/label-in-name.ts) fails when it should: words compare
 * without case, accents, punctuation or symbols, side by side and in order; what only a screen
 * reader hears is not shown, aria-hidden text is; and a name that rewrites a range's dash as
 * 'to' (the CI's 2026-11-20 failure) is caught. Without these checks every test that uses it
 * could pass on a helper that checks nothing.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  accessibleNameOf,
  containsShownWords,
  expectLabelInName,
  shownText,
  startsWithShownWords,
  wordsOf,
} from '../../utils/label-in-name';

afterEach(cleanup);

describe('wordsOf', () => {
  it('drops case, accents, punctuation and symbols, a dash and a middle dot included', () => {
    expect(wordsOf('Hackathon · May 19 – 20, 2026')).toEqual([
      'hackathon',
      'may',
      '19',
      '20',
      '2026',
    ]);
    expect(wordsOf('Café, ⌘K')).toEqual(['cafe', 'k']);
    expect(wordsOf('grepo.example.com')).toEqual(['grepo', 'example', 'com']);
    expect(wordsOf(' – · ')).toEqual([]);
  });
});

describe('containsShownWords and startsWithShownWords', () => {
  const shown = 'Antler NYC Hackathon · May 19 – 20, 2026';

  it('finds the words shown side by side and in order, at the start or anywhere', () => {
    const name = 'Antler NYC, Hackathon, May 19 – 20, 2026, photo 1 of 5';
    expect(startsWithShownWords(name, shown)).toBe(true);
    expect(containsShownWords(`Fig. 2, ${name}`, shown)).toBe(true);
    expect(startsWithShownWords(`Fig. 2, ${name}`, shown)).toBe(false);
  });

  it('fails a word put between them, as "to" for a range’s dash', () => {
    const name = 'Antler NYC, Hackathon, May 19 to 20, 2026, photo 1 of 5';
    expect(containsShownWords(name, shown)).toBe(false);
    expect(
      containsShownWords('Listening on Spotify: Nights by Frank Ocean', 'Nights Frank Ocean'),
    ).toBe(false);
  });

  it('fails words out of order or left out', () => {
    expect(containsShownWords('Hackathon, Antler NYC', 'Antler NYC Hackathon')).toBe(false);
    expect(containsShownWords('Open screen 1 of 2', 'grepo.example.com')).toBe(false);
  });

  it('holds nothing to check when nothing is shown', () => {
    expect(startsWithShownWords('Close', '')).toBe(true);
  });
});

describe('shownText', () => {
  it('leaves out sr-only and hidden words, and keeps aria-hidden ones, which are seen', () => {
    render(
      <a href="/x" aria-label="x">
        May 19<span aria-hidden="true"> – </span>
        <span className="sr-only"> to </span>
        20<span hidden> never</span>
      </a>,
    );

    expect(shownText(screen.getByRole('link'))).toBe('May 19 – 20');
  });

  it('joins neighbouring elements as written, as the checkers do', () => {
    render(
      <button type="button" aria-label="x">
        <span>Command menu</span>
        <kbd>Ctrl K</kbd>
      </button>,
    );

    // A flexbox gap is no space: 'menu' and 'Ctrl' run together.
    expect(shownText(screen.getByRole('button'))).toBe('Command menuCtrl K');
  });
});

describe('expectLabelInName', () => {
  it('passes a name that starts with the words shown, read from aria-label as a browser does', () => {
    render(
      <a href="/x" aria-label="May 19 – 20, 2026, photo 1 of 5">
        May 19<span aria-hidden="true"> – </span>
        <span className="sr-only"> to </span>
        20, 2026
      </a>,
    );
    const link = screen.getByRole('link');

    expect(accessibleNameOf(link)).toBe('May 19 – 20, 2026, photo 1 of 5');
    expect(() => expectLabelInName(link)).not.toThrow();
  });

  it('fails a name that rewrites the words shown, saying both', () => {
    render(
      <a href="/x" aria-label="May 19 to 20, 2026">
        May 19 – 20, 2026
      </a>,
    );

    expect(() => expectLabelInName(screen.getByRole('link'))).toThrow(
      'The name "May 19 to 20, 2026" does not start with the words shown, "May 19 – 20, 2026"',
    );
  });

  it('takes a name that only holds the words with start: false, for a hint after the name', () => {
    render(
      <button type="button" aria-label="Search pages and commands, Ctrl K">
        <kbd>Ctrl K</kbd>
      </button>,
    );
    const button = screen.getByRole('button');

    expect(() => expectLabelInName(button)).toThrow(/does not start with/);
    expect(() => expectLabelInName(button, { start: false })).not.toThrow();
  });

  it('refuses an element that shows no words, which has nothing to hold', () => {
    render(
      <button type="button" aria-label="Close">
        <svg aria-hidden="true" />
      </button>,
    );

    expect(() => expectLabelInName(screen.getByRole('button'))).toThrow(/shows no words/);
  });
});
