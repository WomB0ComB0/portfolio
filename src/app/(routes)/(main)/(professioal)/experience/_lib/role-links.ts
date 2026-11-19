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
 * @file The addresses in a role's text as named links, for chips. Pure and isomorphic. Studio
 * has no link field: the links are raw http(s) addresses inside the description and the duties
 * (text-links.ts finds them), so a name can only come from the words around one:
 *
 * - on a code host, the owner and repository from the address itself, as a token;
 * - else the proper name right before the bracket: "… in IEEE LISAT 2024 (https://…)";
 * - else the host.
 *
 * Nothing is guessed. A run of capitalised words that opens its sentence may start with a verb
 * ("Posted TechRxiv"), so it is not taken for a name and the host stands.
 */

import { splitLinks } from './text-links';

export interface RoleLink {
  readonly href: string;
  /** A proper name from the text, a repository's slug, or the host. */
  readonly label: string;
  /** The site, to set faint beside a label that is not the host itself; null when it is. */
  readonly host: string | null;
  /** The label is a machine token (a repository slug), set in the mono face. */
  readonly token: boolean;
}

type LinkName = Omit<RoleLink, 'href'>;

interface Address {
  /** Lower case, without www. */
  readonly host: string;
  readonly segments: readonly string[];
  readonly search: string;
  /** '#setup', or '' without one: two parts of one page are two links. */
  readonly hash: string;
}

/** Hosts whose first two path segments are an owner and a repository. */
const CODE_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);
const SLUG_SEGMENTS = 2;
/** A name longer than this is more likely a sentence in title case. */
const MAX_NAME_WORDS = 5;
/** Small words a name may hold inside it ("Alliance of Nevada"), never at either end. */
const NAME_JOINERS = new Set(['of', 'for', 'the', 'de']);
/** A word of a name: it opens with a capital or a figure and does not end in punctuation. */
const NAME_WORD = /^[\p{Lu}\p{N}](?:[\p{L}\p{N}'’&.+#/-]*[\p{L}\p{N}+#])?$/u;
const SENTENCE_BREAK = /[.!?]$/u;
const WWW = /^www\./u;
const SECOND_LEVEL_SUFFIX_MAX = 3;
const COUNTRY_SUFFIX_LENGTH = 2;

/** An address's host and path segments; null when it cannot be read. */
function readAddress(href: string): Address | null {
  try {
    const url = new URL(href);
    return {
      host: url.hostname.replace(WWW, ''),
      segments: url.pathname.split('/').filter(Boolean),
      search: url.search,
      hash: url.hash,
    };
  } catch {
    return null;
  }
}

/**
 * The site a host belongs to: its last two parts ('notion.site' of 'x.notion.site'), or three
 * under a two-part country suffix ('example.co.uk').
 */
export function siteOf(host: string): string {
  const parts = host.replace(WWW, '').split('.');
  const suffix = parts.at(-1) ?? '';
  const second = parts.at(-2) ?? '';
  const underCountry =
    suffix.length === COUNTRY_SUFFIX_LENGTH && second.length <= SECOND_LEVEL_SUFFIX_MAX;
  return parts.slice(underCountry ? -3 : -2).join('.');
}

const isNameWord = (word: string): boolean => NAME_WORD.test(word);

/**
 * Where the run of name words that ends `words` begins and ends (one past its last word), with
 * joiners kept only between two name words; null when the words do not end in a name.
 */
function trailingRun(words: readonly string[]): { start: number; end: number } | null {
  const stop = words.findLastIndex(
    (word) => !isNameWord(word) && !NAME_JOINERS.has(word.toLowerCase()),
  );
  const start = words.findIndex((word, index) => index > stop && isNameWord(word));
  return start === -1 ? null : { start, end: words.findLastIndex(isNameWord) + 1 };
}

/**
 * The proper name right before a bracketed address: the capitalised words (figures count) that
 * end `before`, up to MAX_NAME_WORDS. Null when there are none, when the address is not in
 * brackets, or when the run opens its sentence and so may begin with a verb.
 */
export function properNameBefore(before: string): string | null {
  const text = before.trimEnd();
  if (!text.endsWith('(')) return null;
  const words = text.slice(0, -1).trim().split(/\s+/u).filter(Boolean);
  const run = trailingRun(words);
  if (!run || run.end - run.start > MAX_NAME_WORDS) return null;
  const previous = words[run.start - 1];
  const opensSentence = previous === undefined || SENTENCE_BREAK.test(previous);
  return opensSentence ? null : words.slice(run.start, run.end).join(' ');
}

/** What a link is called, from its address and the text before it. */
function nameOf(href: string, fallback: string, before: string): LinkName {
  const address = readAddress(href);
  if (!address) return { label: fallback, host: null, token: false };
  const { host, segments } = address;
  if (CODE_HOSTS.has(host) && segments.length > 0) {
    return { label: segments.slice(0, SLUG_SEGMENTS).join('/'), host, token: true };
  }
  const name = properNameBefore(before);
  return name
    ? { label: name, host: siteOf(host), token: false }
    : { label: host, host: null, token: false };
}

/**
 * What makes two addresses the same: the host without www, the path without a last slash, the
 * query and the fragment (a link to one part of a page is not a link to another).
 */
function identityOf(href: string): string {
  const address = readAddress(href);
  return address
    ? `${address.host}/${address.segments.join('/')}${address.search}${address.hash}`
    : href.toLowerCase();
}

/** Every link in one text, in order, each named from the words before it. */
function linksIn(text: string): RoleLink[] {
  const parts = splitLinks(text);
  return parts.flatMap((part, index): RoleLink[] => {
    if (part.kind !== 'link') return [];
    const previous = parts[index - 1];
    const before = previous?.kind === 'text' ? previous.text : '';
    return [{ href: part.href, ...nameOf(part.href, part.label, before) }];
  });
}

/**
 * The links in a role's texts (its description first, then each duty), each address once, in
 * reading order; the first mention's name stands.
 */
export function roleLinksOf(texts: readonly string[]): RoleLink[] {
  const links = texts.flatMap(linksIn);
  const identities = links.map((link) => identityOf(link.href));
  return links.filter((_, index) => identities.indexOf(identities[index] ?? '') === index);
}

/** A Studio organization URL as a first-class role link, named by its code host or site. */
export function organizationLinkOf(companyUrl: string | null | undefined): RoleLink | null {
  if (!companyUrl) return null;
  try {
    const url = new URL(companyUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./u, '').toLowerCase();
    if (host === 'github.com') {
      return {
        href: companyUrl,
        label:
          url.pathname.split('/').filter(Boolean).length === 1 ? 'GitHub organization' : 'GitHub',
        host,
        token: false,
      };
    }
    if (host === 'gitlab.com') {
      return { href: companyUrl, label: 'GitLab organization', host, token: false };
    }
    if (host === 'bitbucket.org') {
      return { href: companyUrl, label: 'Bitbucket organization', host, token: false };
    }
    return { href: companyUrl, label: 'Organization website', host: siteOf(host), token: false };
  } catch {
    return null;
  }
}

/** Merge a code-host organization link before text-derived links without duplicating addresses. */
export function mergeOrganizationLink(
  companyUrl: string | null | undefined,
  links: readonly RoleLink[],
): readonly RoleLink[] {
  const organization = organizationLinkOf(companyUrl);
  if (
    !organization?.host ||
    !['github.com', 'gitlab.com', 'bitbucket.org'].includes(organization.host)
  ) {
    return links;
  }
  const merged = [organization, ...links];
  const identities = merged.map((link) => identityOf(link.href));
  return merged.filter((_, index) => identities.indexOf(identities[index] ?? '') === index);
}
