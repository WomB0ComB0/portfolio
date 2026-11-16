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
 * @file A line of context that wraps part by part instead of being cut: '73.5% acceptance · rank
 * 103,899 · updated 3 h ago', or 'Latest commit · portfolio · 8 h ago'. Server-safe (no
 * directive, no hooks).
 *
 * The parts are items of a wrapping row, each after the first led by the separator. The row is
 * pulled one separator's width to the left and the line clips it, so the separator of whichever
 * part starts a row is cut off: a row never starts or ends with a dot, and a dot never sits
 * alone. A part wider than the whole line breaks inside itself as a last resort, so nothing is
 * ever hidden.
 *
 * That width is 1.1ch (the line's own digit width, about 0.75em), not an em length: a phone that
 * enlarges text without changing lengths leaves em where it was, and the words closed in on a
 * dot whose box had not grown with it. ch follows the text as drawn.
 */

import type { ReactElement, ReactNode } from 'react';

import { META_SEPARATOR } from '@/app/_components/home/tiles/tile-states';
import { cn } from '@/lib/utils';

const LINE_CLASS = 'block min-w-0 overflow-hidden';
const ROW_CLASS = '-ml-[1.1ch] flex flex-wrap gap-y-1';
const PART_CLASS = 'flex max-w-full min-w-0';
/** The first part has no separator; it keeps the separator's width, which the line clips. */
const FIRST_PART_CLASS = `${PART_CLASS} pl-[1.1ch]`;
const SEPARATOR_CLASS = 'flex w-[1.1ch] shrink-0 justify-center whitespace-pre';
const BODY_CLASS = 'min-w-0 [overflow-wrap:anywhere]';

/** One part of the line. */
export interface MetaPart {
  /** Unique within the line. */
  readonly key: string;
  readonly body: ReactNode;
}

export interface MetaRowProps {
  /** The parts in reading order; an empty list renders nothing. */
  readonly parts: readonly MetaPart[];
  /** Classes for the line (the clipping box), e.g. a flex basis beside a stale note. */
  readonly className?: string;
}

/**
 * The parts of `text` (a line joined by META_SEPARATOR), then any `extra` parts after them.
 *
 * @example metaParts('60 s best · 1,022 tests') // two parts, keyed by their words
 */
export function metaParts(text: string, extra: readonly MetaPart[] = []): MetaPart[] {
  const words = text === '' ? [] : text.split(META_SEPARATOR);
  return [...words.map((word) => ({ key: word, body: word })), ...extra];
}

/** The line: its parts in a wrapping row, every separator inside the part it leads. */
export function MetaRow({ parts, className }: MetaRowProps): ReactElement | null {
  if (parts.length === 0) return null;
  return (
    <span data-context-line="" className={cn(LINE_CLASS, className)}>
      <span className={ROW_CLASS}>
        {parts.map((part, index) => (
          <span
            key={part.key}
            data-context-part=""
            className={index === 0 ? FIRST_PART_CLASS : PART_CLASS}
          >
            {index > 0 && <span className={SEPARATOR_CLASS}>{META_SEPARATOR}</span>}
            <span className={BODY_CLASS}>{part.body}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
