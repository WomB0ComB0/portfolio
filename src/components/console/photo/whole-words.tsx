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
 * @file Short names a browser would otherwise split where they would fit whole: a word with a
 * hyphen, dash or slash between two characters ('(PG-FMS)', 'Speech-to-Text', 'CNN/U-Net'). Each
 * is held as one inline block, never wider than its column, the way the project page's
 * breakable.tsx holds a long address: it moves whole to the next line whenever it fits there, and
 * breaks at its own hyphens or slashes only when it is wider than the line (overflow-wrap is the
 * last resort for a part wider still), so it never runs past its box. A word is everything between
 * two spaces, so its brackets and punctuation stay with it and never start a line. The text is
 * untouched: no character is added or dropped, so it copies and reads aloud as written. Shared by
 * the photo grid's names (/places/photos, /projects Screens) and the project page's Built with.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

/** One word held whole: as wide as its column at most, and taking its parent's underline. */
export const WHOLE_WORD_CLASS = 'inline-block max-w-full [text-decoration:inherit]';

/** A hyphen, a dash or a slash between two characters: where a browser may break a word. */
const BREAKS_INSIDE = /\S[-‐–—/]\S/u;
/** The runs of space between words, captured, so they land at the odd places of a split. */
const SPACES = /(\s+)/u;

/** Whether a browser could break this word inside itself, at a hyphen, a dash or a slash. */
export const breaksInside = (word: string): boolean => BREAKS_INSIDE.test(word);

const asWritten = (word: string): ReactNode => word;

export interface WholeWordsProps {
  readonly text: string;
  /** Which words to hold whole; those a browser could break inside (breaksInside) by default. */
  readonly isWhole?: (word: string) => boolean;
  /** How each word is drawn (with its own break points, say); as written by default. */
  readonly renderWord?: (word: string) => ReactNode;
}

/**
 * The text with each word `isWhole` picks held whole, its spaces kept as written. A text of one
 * word is the whole line already, so it needs no block (it breaks only when wider than the line),
 * and a text with no such word is drawn as it is.
 */
export function WholeWords({
  text,
  isWhole = breaksInside,
  renderWord = asWritten,
}: WholeWordsProps): ReactElement {
  const pieces = text.split(SPACES);
  if (pieces.length === 1) return <>{renderWord(text)}</>;
  return (
    <>
      {pieces.map((piece, at) => {
        if (piece === '') return null;
        const space = at % 2 === 1;
        return space || !isWhole(piece) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are fixed text and may repeat.
          <Fragment key={at}>{space ? piece : renderWord(piece)}</Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are fixed text and may repeat.
          <span key={at} className={WHOLE_WORD_CLASS}>
            {renderWord(piece)}
          </span>
        );
      })}
    </>
  );
}
