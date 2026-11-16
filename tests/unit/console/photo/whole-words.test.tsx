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
 * @file Whole words (whole-words.tsx): a word a browser could split at a hyphen, a dash or a slash
 * is held as one inline block, its brackets and punctuation with it, so it moves whole to the next
 * line when it fits there; every other word, and every space, is left as written. The text never
 * changes: what the page holds reads and copies as the name was written.
 */

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { breaksInside, WHOLE_WORD_CLASS, WholeWords } from '@/components/console/photo/whole-words';

/** The held words' text, in order. */
const heldIn = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('span'), (span) => span.textContent ?? '');

describe('breaksInside', () => {
  it('finds a hyphen, a dash or a slash between two characters', () => {
    for (const word of ['(PG-FMS)', 'Speech-to-Text', 'CNN/U-Net', '2024–2025', 'AI—ML']) {
      expect(breaksInside(word), word).toBe(true);
    }
  });

  it('leaves plain words, dotted names and a lone dash alone', () => {
    for (const word of ['SparkMind', 'Next.js', '—', '-', 'end-', '-start']) {
      expect(breaksInside(word), word).toBe(false);
    }
  });
});

describe('WholeWords', () => {
  it('holds a hyphenated word whole, its brackets and punctuation with it', () => {
    const { container } = render(
      <WholeWords text="Purple Geckos File Management System (PG-FMS)," />,
    );

    expect(heldIn(container)).toEqual(['(PG-FMS),']);
    expect(container.querySelector('span')).toHaveClass(...WHOLE_WORD_CLASS.split(' '));
    expect(container).toHaveTextContent('Purple Geckos File Management System (PG-FMS),');
  });

  it('keeps the text exactly as written, every space included', () => {
    const text = '  Google  Speech-to-Text \tand CNN/U-Net ';
    const { container } = render(<WholeWords text={text} />);

    expect(container.textContent).toBe(text);
    expect(heldIn(container)).toEqual(['Speech-to-Text', 'CNN/U-Net']);
  });

  it('draws a one-word text or one with nothing to hold as it is, with no block', () => {
    expect(renderToStaticMarkup(<WholeWords text="FOIA-Stream" />)).toBe('FOIA-Stream');
    expect(renderToStaticMarkup(<WholeWords text="NY Tech Week 2026 — SoHo" />)).toBe(
      'NY Tech Week 2026 — SoHo',
    );
  });

  it('holds the words a caller picks, each drawn by the caller', () => {
    const { container } = render(
      <WholeWords
        text="Firebase links.example.dev Speech-to-Text"
        isWhole={(word) => word.includes('.')}
        renderWord={(word) => <b>{word}</b>}
      />,
    );

    expect(heldIn(container)).toEqual(['links.example.dev']);
    expect(container.querySelectorAll('b')).toHaveLength(3);
    expect(container).toHaveTextContent('Firebase links.example.dev Speech-to-Text');
  });
});
