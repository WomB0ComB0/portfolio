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
 * @file Raw links in a Studio description ("the blog (https://blog.curvance.com)"), split out so
 * the detail page can show them as links named by their address without the scheme. Only http
 * and https become links (an href never gets another scheme); brackets and a sentence's last
 * punctuation stay text. Pure; React escapes every part.
 */

import { SLASH, TRAILING_PUNCTUATION, trimEnd } from '@/lib/text/trim';

export type TextPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly href: string; readonly label: string };

/**
 * An http(s) address up to whitespace or a closing bracket it did not open: a bracketed part
 * inside it stays (".../wiki/Mercury_(planet)"), while the bracket that closes the text's own
 * "(https://…)" is left as text. Brackets are not nested any deeper.
 */
const ADDRESS = /https?:\/\/(?:[^\s()]|\([^\s()]*\))+/giu;

/** 'https://www.example.org/path/' -> 'example.org/path'. */
function labelOf(href: string): string {
  return trimEnd(href.replace(/^https?:\/\//iu, '').replace(/^www\./iu, ''), SLASH);
}

/** The text and links of `text`, in order; empty text gives no parts. */
export function splitLinks(text: string): readonly TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  const pushText = (value: string): void => {
    if (value) parts.push({ kind: 'text', text: value });
  };
  for (const match of text.matchAll(ADDRESS)) {
    // The sentence's own punctuation, trimmed by a loop: one entry written as a link with a long
    // run of full stops took seconds per render with a '[…]+$' pattern.
    const href = trimEnd(match[0], TRAILING_PUNCTUATION);
    pushText(text.slice(cursor, match.index));
    parts.push({ kind: 'link', href, label: labelOf(href) });
    cursor = match.index + href.length;
  }
  pushText(text.slice(cursor));
  return parts;
}
