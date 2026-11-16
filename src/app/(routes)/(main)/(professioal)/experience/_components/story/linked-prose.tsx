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
 * @file A role's prose with its links named in place ("in IEEE LISAT 2024"), as the story's
 * stops print it. Server-safe (no directive, no hooks). Each link opens in a new tab, says so to
 * a screen reader and carries the house arrow glued to its last word. A link inside a sentence
 * is exempt from the target-size rule (WCAG 2.5.8, inline), so it keeps the sentence's line.
 *
 * A long token may break only at its own seams: an address named by its host after a dot or a
 * slash ("kappathetapi." / "org"), and a word joined by a slash ("improvements/revamp") after
 * its slash, never inside a word. Each such word, with the brackets and punctuation glued to it
 * ("(blog.curvance.com ↗)."), is one inline block that holds those breaks, as the project page
 * keeps a long address (projects/_components/detail/breakable.tsx): it moves whole to the next
 * line whenever it fits there, and wraps at its seams only when it is wider than the line, so
 * a line never ends on "Grants." or "(app." and a ")" never starts one.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { NEW_TAB_LABEL, NewTabArrow } from '@/components/console';
import { cn } from '@/lib/utils';
import type { LinkedPart } from '../../_lib/linked-text';

/**
 * Brand ink with a quiet underline that takes the ink's full colour on hover or focus. Only the
 * underline's colour moves, so nothing shifts.
 */
const LINK_CLASS =
  'rounded-[0.1875rem] text-brand-ink underline decoration-(--brand-edge) decoration-1 underline-offset-[0.2em] transition-[text-decoration-color] duration-(--motion-fast) ease-effect [overflow-wrap:anywhere] hover:decoration-current focus-visible:decoration-current';

/**
 * One word that may break at its seams: whole when it fits a line, never wider than its column
 * (the project page's run, breakable.tsx). It takes its parent's decoration, which an inline
 * block would otherwise drop.
 */
const WHOLE_CLASS = 'inline-block max-w-full [text-decoration:inherit]';

/** A link named by its host ('blog.curvance.com'), not by a proper name. */
const HOST_LABEL = /^[\w-]+(?:\.[\w-]+)+$/u;

/** Slashes in running text; dots and slashes in a host. */
const SLASH = /(\/)/u;
const DOT_OR_SLASH = /([./])/u;
/** A host written in running text, with the punctuation around it ('(app.curvance.com),'). */
const HOST_TOKEN = /^\(?[\w-]+(?:\.[\w-]+)+[,.;:)]*$/u;

/**
 * A piece of a word, glued to the pieces beside it: plain text, or a token or link that holds a
 * <wbr> (so its word is kept whole whenever it fits a line).
 */
type Piece =
  | { readonly breaks: false; readonly text: string }
  | { readonly breaks: true; readonly node: ReactNode };

/** The prose in order: spaces, pieces of words, and named links, which stand as they are. */
type Run =
  | { readonly kind: 'space'; readonly text: string }
  | { readonly kind: 'piece'; readonly piece: Piece }
  | { readonly kind: 'alone'; readonly node: ReactElement };

/**
 * `text` with a line-break opportunity (<wbr>) after each character `at` matches, so a token
 * too long for its line breaks there rather than inside a word; the text reads the same. Null
 * when it has no such character.
 */
function breakAfter(text: string, at: RegExp): ReactNode[] | null {
  const pieces = text.split(at);
  if (pieces.length === 1) return null;
  return pieces.map((piece, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are a fixed sequence.
    <Fragment key={index}>
      {piece}
      {at.test(piece) ? <wbr /> : null}
    </Fragment>
  ));
}

/** Running text as spaces and pieces: a host breakable after its dots, a word after a slash. */
function textRuns(text: string): Run[] {
  return text
    .split(/(\s+)/u)
    .filter((token) => token !== '')
    .map((token): Run => {
      if (/^\s/u.test(token)) return { kind: 'space', text: token };
      const node = breakAfter(token, HOST_TOKEN.test(token) ? DOT_OR_SLASH : SLASH);
      return {
        kind: 'piece',
        piece: node === null ? { breaks: false, text: token } : { breaks: true, node },
      };
    });
}

/** A link: a piece of its word when named by its host, else a named link as it stands. */
function linkRun(part: Extract<LinkedPart, { kind: 'link' }>, index: number): Run {
  const host = HOST_LABEL.test(part.label);
  const link = (
    <a
      // Keyed by its place among the parts: one address may appear twice.
      key={index}
      href={part.href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
    >
      {(host && breakAfter(part.label, DOT_OR_SLASH)) || part.label}
      <NewTabArrow />
      {/*
       * The words open on a comma, not a space: a space inside the link would show before
       * the sentence's own comma ("3D Girls ↗ ,"), and a comma still parts them where an
       * engine trims a hidden span's leading space.
       */}
      <span className="sr-only">{`, ${NEW_TAB_LABEL}`}</span>
    </a>
  );
  return host
    ? { kind: 'piece', piece: { breaks: true, node: link } }
    : { kind: 'alone', node: link };
}

/** One word's pieces: one inline block when any may break, else its plain text. */
function wordNode(pieces: readonly Piece[], key: number): ReactNode {
  if (!pieces.some((piece) => piece.breaks)) {
    return pieces.map((piece) => (piece.breaks ? '' : piece.text)).join('');
  }
  return (
    <span key={`w${key}`} className={WHOLE_CLASS}>
      {pieces.map((piece, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are a fixed sequence.
        <Fragment key={index}>{piece.breaks ? piece.node : piece.text}</Fragment>
      ))}
    </span>
  );
}

/** The parts as nodes: each word that may break kept whole, neighbouring plain text joined. */
function proseNodes(parts: readonly LinkedPart[]): ReactNode[] {
  const runs = parts.flatMap((part, index) =>
    part.kind === 'text' ? textRuns(part.text) : [linkRun(part, index)],
  );
  const nodes: ReactNode[] = [];
  const add = (node: ReactNode): void => {
    const last = nodes.at(-1);
    if (typeof node === 'string' && typeof last === 'string') nodes[nodes.length - 1] = last + node;
    else if (node !== '') nodes.push(node);
  };
  let word: Piece[] = [];
  const endWord = (): void => {
    if (word.length > 0) add(wordNode(word, nodes.length));
    word = [];
  };
  for (const run of runs) {
    if (run.kind === 'piece') {
      word = [...word, run.piece];
      continue;
    }
    endWord();
    add(run.kind === 'space' ? run.text : run.node);
  }
  endWord();
  return nodes;
}

export interface LinkedProseProps {
  readonly parts: readonly LinkedPart[];
  readonly as?: 'p' | 'span';
  readonly className?: string;
}

/** The parts as one paragraph (or span); nothing when there are none. */
export function LinkedProse({
  parts,
  as: Element = 'p',
  className,
}: LinkedProseProps): ReactElement | null {
  if (parts.length === 0) return null;
  return (
    <Element data-prose="" className={cn('[overflow-wrap:break-word]', className)}>
      {proseNodes(parts)}
    </Element>
  );
}
