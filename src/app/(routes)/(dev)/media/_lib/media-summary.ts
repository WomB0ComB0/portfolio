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
 * @file The one line a /media row says about itself: the first real sentence of a description.
 * YouTube descriptions here open with prose (when there is any) and end in a link template;
 * Twitch's export adds its own "Broadcasted live" line. Neither says anything about the video,
 * so both are dropped. Pure and server-safe.
 */

/** The longest summary kept; the row truncates it again to its width. */
const SUMMARY_MAX = 160;
/**
 * The most of a description read: YouTube's own limit, so an oversized CMS entry cannot burn CPU
 * on every /media and project page (the line patterns grow with the square of a long line).
 */
const SUMMARY_READ_MAX = 5_000;

/** A line that starts with an emoji opens YouTube's link template: everything after is template. */
const TEMPLATE_START = /^\p{Extended_Pictographic}/u;
/** A scheme or a www. at a word's start (the Twitch line, a LinkTree). */
const LINK_START = /\bhttps?:\/\/|\bwww\./i;
/** A letter, digit or hyphen: what a short-link host's label is made of. */
const LABEL_CHAR = /[a-z\d-]/i;
/** A word character, as a pattern's \b reads one. */
const WORD_CHAR = /\w/;
/** What follows a short-link host's label: '.gg/', '.ly/' or '.ee/'. Sticky: read at one place. */
const SHORT_LINK_END = /\.(?:gg|ly|ee)\//iy;
/** The first sentence: up to a stop followed by a space or the end. */
const FIRST_SENTENCE = /^.+?[.!?](?=\s|$)/;

/** Whether a pattern's \b holds before `line[index]`: a word character on one side only. */
const isWordEdge = (line: string, index: number): boolean =>
  WORD_CHAR.test(line.charAt(index - 1)) !== WORD_CHAR.test(line.charAt(index));

/**
 * Whether `line` holds a bare short link ('dsc.gg/abc', 'bit.ly/x'): a run of label characters
 * with a word edge in it, then '.gg/', '.ly/' or '.ee/'. Each run is read once. The pattern this
 * replaced ('\b[a-z\d-]+\.(?:gg|ly|ee)\/') read the rest of a run from every word edge in it, 30 ms
 * for one description of 'a-' repeated; it matched exactly these runs.
 */
function hasShortLink(line: string): boolean {
  let index = 0;
  while (index < line.length) {
    let hasWordEdge = false;
    const start = index;
    while (index < line.length && LABEL_CHAR.test(line.charAt(index))) {
      hasWordEdge ||= isWordEdge(line, index);
      index += 1;
    }
    SHORT_LINK_END.lastIndex = index;
    if (hasWordEdge && SHORT_LINK_END.test(line)) return true;
    if (index === start) index += 1;
  }
  return false;
}

/** A line with a link in it (the Twitch line, a LinkTree, a bare dsc.gg invite). */
const hasLink = (line: string): boolean => LINK_START.test(line) || hasShortLink(line);

/** `text` cut to `max` characters at a word, with an ellipsis; as it is when it fits. */
function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const end = lastSpace > max / 2 ? lastSpace : max;
  return `${cut.slice(0, end).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

/**
 * The first real sentence of a description: lines with links are skipped, and YouTube's link
 * template (from its first emoji-led line on) is dropped. '' when nothing real is left.
 */
export function cleanSummary(text: string | null | undefined): string {
  if (!text) return '';
  const kept: string[] = [];
  for (const raw of text.slice(0, SUMMARY_READ_MAX).split(/\r?\n/)) {
    const line = raw.trim();
    if (TEMPLATE_START.test(line)) break;
    if (line !== '' && !hasLink(line)) kept.push(line);
  }
  const prose = kept.join(' ').replaceAll(/\s+/g, ' ').trim();
  if (prose === '') return '';
  return capAtWord(FIRST_SENTENCE.exec(prose)?.[0] ?? prose, SUMMARY_MAX);
}
