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
 * @file Byline: the small sentence-case line under a title ('CLI Tool · Feb 2026 · In progress')
 * where counts, kinds, months and status live, so nothing needs a column header. Server-safe (no
 * directive, no hooks), so a server page or a client island can draw it.
 *
 * Geist sans with tabular figures (tile-meta), never tracked mono capitals. A status keeps the
 * house dot beside its word; the dot alone never carries meaning. The separator is glued to the
 * part before it with a no-break space, so a wrapped line never starts with a dot.
 *
 * Read aloud, the parts stay apart: only the no-break space and the dot are hidden from assistive
 * tech. The space after the dot is real text between the parts' spans, and an empty pause span
 * adds a comma as generated-content alt text (globals.css byline-pause), so Chromium's
 * accessibility tree reads 'Public Safety, Apr 2026 – now, In progress' rather than 'Public
 * SafetyApr 2026 – nowIn progress'. Generated content is not in textContent, so the line's text
 * stays 'Public Safety · Apr 2026 – now · …'. Without alt-text support the space alone remains.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { StatusDot } from '../status-dot';
import { type BylineItem, type BylinePart, bylineItems } from './byline-items';

/**
 * Lines break at spaces; a word wider than its whole line (a narrow column at 200% text) breaks
 * as the last resort rather than pushing the page sideways.
 */
const ROOT_CLASS = 'tile-meta text-faint [overflow-wrap:break-word] [text-wrap:pretty]';
const SEPARATOR_CLASS = 'text-hairline-strong';
/** The dot, glued to the part before it by a no-break space; hidden from assistive tech. */
const SEPARATOR_MARK = ' ·';
/**
 * The pause a screen reader hears between parts: an empty ::after whose alt text is ', '
 * (globals.css byline-pause), so it is spoken but never drawn and never in textContent.
 */
const PAUSE_CLASS = 'byline-pause';
const STATUS_CLASS = 'text-muted-foreground';
/** The dot stays with the status's first word; the rest of the words wrap as any others. */
const STATUS_HEAD_CLASS = 'whitespace-nowrap';
/** The dot sits on the middle of the x-height, not the baseline. */
const DOT_CLASS = 'me-1.5 align-middle';

/** A status's first word, which keeps the dot, and the words after it. */
function splitHead(text: string): [string, string] {
  const space = text.indexOf(' ');
  return space < 0 ? [text, ''] : [text.slice(0, space), text.slice(space)];
}

/** A part's words: plain, or a status with the house dot beside its first word. */
function PartWords({ item }: { readonly item: BylineItem }): ReactNode {
  if (!item.tone) return item.text;
  const [head, tail] = splitHead(item.text);
  return (
    <span className={STATUS_CLASS} data-tone={item.tone}>
      <span className={STATUS_HEAD_CLASS}>
        <StatusDot tone={item.tone} pulse={item.pulse} className={DOT_CLASS} />
        {head}
      </span>
      {tail}
    </span>
  );
}

/**
 * The separator after a part: the dot (hidden) and the spoken comma. The real space comes after
 * the part's own span (Byline), so the line breaks only there: the dot ends a line, never starts
 * one, and every accessible-name engine keeps the space between parts.
 */
function Separator(): ReactElement {
  return (
    <>
      <span aria-hidden="true" data-byline-separator="" className={SEPARATOR_CLASS}>
        {SEPARATOR_MARK}
      </span>
      <span data-byline-pause="" className={PAUSE_CLASS} />
    </>
  );
}

export interface BylineProps {
  /** The parts in reading order: kind, month, status. Blanks and repeats are left out. */
  readonly parts: readonly BylinePart[];
  /** The element: a paragraph by default, a span inside a heading or a link. */
  readonly as?: 'p' | 'span' | 'div';
  readonly className?: string;
}

/**
 * The meta line under a title. Draws nothing when no part has words.
 *
 * @example
 * <Byline parts={['CLI Tool', 'Feb 2026', { text: 'In progress', tone: 'ongoing' }]} />
 */
export function Byline({ parts, as: Element = 'p', className }: BylineProps): ReactElement | null {
  const items = bylineItems(parts);
  if (items.length === 0) return null;
  return (
    <Element data-byline="" className={cn(ROOT_CLASS, className)}>
      {items.map((item, index) => (
        <Fragment key={item.text}>
          {index > 0 ? ' ' : null}
          <span>
            <PartWords item={item} />
            {index < items.length - 1 ? <Separator /> : null}
          </span>
        </Fragment>
      ))}
    </Element>
  );
}
