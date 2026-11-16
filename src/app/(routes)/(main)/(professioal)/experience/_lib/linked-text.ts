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
 * @file A role's prose with its raw addresses turned into named links, for the /experience
 * story: "in IEEE LISAT 2024 (https://…)" reads "in IEEE LISAT 2024", the name itself the link.
 * Pure and isomorphic; React escapes every part. Studio has no link field, so a name can only
 * come from the words right before an address (role-links.ts's rule, never a guess):
 *
 * - a proper name before a bracketed address becomes the link, and the bracket goes;
 * - the address's own host written right before it ("blog.curvance.com (https://…)") becomes
 *   the link, so the host is not printed twice;
 * - any other address is the link, named by its host without www, inside its own brackets
 *   ("website (kappathetapi.org)"), or after its dash when it ends the text.
 *
 * Only http and https become links (text-links.ts finds them).
 */

import { properNameBefore } from './role-links';
import { splitLinks, type TextPart } from './text-links';

export type LinkedPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly href: string; readonly label: string };

type AddressPart = Extract<TextPart, { kind: 'link' }>;

const WWW = /^www\./iu;

/** An address's host without www; the address itself when it cannot be read. */
function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(WWW, '');
  } catch {
    return href;
  }
}

/** The text before a bracketed address, without its "(" and trailing space; null otherwise. */
function beforeBracket(text: string): string | null {
  const trimmed = text.trimEnd();
  return trimmed.endsWith('(') ? trimmed.slice(0, -1).trimEnd() : null;
}

/** The words the bracket follows that name it: a proper name, or the host written out. */
function nameAtEnd(head: string, host: string): string | null {
  const name = properNameBefore(`${head} (`);
  if (name && head.endsWith(name)) return name;
  const lastWord = head.slice(head.lastIndexOf(' ') + 1);
  return lastWord.replace(WWW, '').toLowerCase() === host.toLowerCase() ? lastWord : null;
}

/** Joins neighbouring text parts and drops empty ones; the input is left as it was. */
function tidy(parts: readonly LinkedPart[]): LinkedPart[] {
  const out: LinkedPart[] = [];
  for (const part of parts) {
    if (part.kind === 'text' && part.text === '') continue;
    const last = out.at(-1);
    if (part.kind === 'text' && last?.kind === 'text') {
      out[out.length - 1] = { kind: 'text', text: last.text + part.text };
    } else {
      out.push(part);
    }
  }
  return out;
}

/**
 * One address with the text before it and the text after it: its parts, and whether the text
 * after loses its first character (the ")" of a bracket the link took).
 */
function linkAt(
  before: string,
  address: AddressPart,
  after: string,
): { readonly parts: LinkedPart[]; readonly takesClose: boolean } {
  const host = hostOf(address.href);
  const head = beforeBracket(before);
  const name = head !== null && after.startsWith(')') ? nameAtEnd(head, host) : null;
  if (head !== null && name) {
    return {
      parts: [
        { kind: 'text', text: head.slice(0, head.length - name.length) },
        { kind: 'link', href: address.href, label: name },
      ],
      takesClose: true,
    };
  }
  return {
    parts: [
      { kind: 'text', text: before },
      { kind: 'link', href: address.href, label: host },
    ],
    takesClose: false,
  };
}

/**
 * `text` as parts, its addresses named links, its whitespace collapsed; empty text gives none.
 *
 * @example
 * linkedText('Published in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/1).')
 * // [text 'Published in ', link 'IEEE LISAT 2024', text '.']
 */
export function linkedText(text: string): LinkedPart[] {
  const parts = splitLinks(text.replace(/\s+/gu, ' ').trim());
  const out: LinkedPart[] = [];
  // The text read since the last address, and whether it starts with a ")" a name took.
  let pending = '';
  let dropClose = false;
  for (const [index, part] of parts.entries()) {
    if (part.kind === 'text') {
      pending += dropClose ? part.text.slice(1) : part.text;
      dropClose = false;
      continue;
    }
    const next = parts[index + 1];
    const linked = linkAt(pending, part, next?.kind === 'text' ? next.text : '');
    out.push(...linked.parts);
    pending = '';
    dropClose = linked.takesClose;
  }
  out.push({ kind: 'text', text: pending });
  return tidy(out);
}

/** The parts as plain words, the links by their names: what a screen reader or a test reads. */
export const linkedPlain = (parts: readonly LinkedPart[]): string =>
  parts.map((part) => (part.kind === 'text' ? part.text : part.label)).join('');

/** The addresses the parts link, in order. */
export const linkedHrefs = (parts: readonly LinkedPart[]): string[] =>
  parts.flatMap((part) => (part.kind === 'link' ? [part.href] : []));

/** A link named by its host ('github.com'), not by a proper name. */
const isHostLabel = (label: string): boolean => /^[\w-]+(?:\.[\w-]+)+$/u.test(label);

/**
 * The parts with each link to an address already linked (in `seen`, or earlier in the parts)
 * set as plain words, so a page has one link, one Tab stop, per address: a proper name stays as
 * its words; a host in its own brackets ("(github.com)") goes with its brackets, since it named
 * nothing but the link. Also the addresses linked so far. The input is left as it was.
 */
export function unlinkRepeats(
  parts: readonly LinkedPart[],
  seen: ReadonlySet<string>,
): { readonly parts: LinkedPart[]; readonly seen: ReadonlySet<string> } {
  const out: LinkedPart[] = [];
  let linked = new Set(seen);
  let dropClose = false;
  for (const [index, part] of parts.entries()) {
    if (part.kind === 'text') {
      out.push({ kind: 'text', text: dropClose ? part.text.slice(1) : part.text });
      dropClose = false;
    } else if (!linked.has(part.href)) {
      out.push(part);
      linked = new Set([...linked, part.href]);
    } else {
      const before = out.at(-1);
      const after = parts[index + 1];
      dropClose =
        isHostLabel(part.label) &&
        before?.kind === 'text' &&
        before.text.endsWith('(') &&
        after?.kind === 'text' &&
        after.text.startsWith(')');
      if (dropClose && before?.kind === 'text') {
        out[out.length - 1] = { kind: 'text', text: before.text.slice(0, -1).trimEnd() };
      } else {
        out.push({ kind: 'text', text: part.label });
      }
    }
  }
  return { parts: tidy(out), seen: linked };
}
