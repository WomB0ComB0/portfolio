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
 * @file Who the /sponsor thank-you row names, from what GitHub Sponsors returned. Pure: the page
 * loads the data, this decides between "unavailable", "nobody yet" and the people to thank.
 */

import type { GitHubSponsorsData, Sponsor } from '@/lib/api-integrations/github-sponsors';

/** One person in the thank-you row, however many sponsorships they made. */
export interface ThanksPerson {
  /** Their login: unique per person, so it keys the list. */
  readonly key: string;
  readonly login: string;
  /** Their name, or their login when GitHub has no name. */
  readonly name: string;
  readonly avatarUrl: string;
  readonly url: string;
  /** Any of their sponsorships is active. */
  readonly isCurrent: boolean;
  /** When their first sponsorship began (ISO 8601), for the order. */
  readonly since: string;
}

export type SponsorsThanks =
  /** GitHub failed or ran past the deadline: nothing is known. */
  | { readonly state: 'unavailable' }
  /** GitHub answered with nobody listable. */
  | { readonly state: 'none' }
  | {
      readonly state: 'thanks';
      /** Current sponsors first, each group longest standing first. */
      readonly people: readonly ThanksPerson[];
      readonly currentCount: number;
    };

/** A name to show: the trimmed name, or the login when the name is missing or blank. */
export function displayNameOf(sponsor: Pick<Sponsor, 'name' | 'login'>): string {
  const name = sponsor.name?.trim();
  return name ? name : sponsor.login;
}

/**
 * GitHub can return a sponsorship whose account is gone (no login to link or key on).
 * getGitHubSponsors already drops these; this keeps the row safe on its own.
 */
const isListable = (sponsor: Sponsor | null | undefined): sponsor is Sponsor =>
  typeof sponsor?.login === 'string' && sponsor.login.length > 0;

/**
 * Folds one more sponsorship into the person it belongs to: current if either is, dated from the
 * earlier one, named and pictured from the later one (the account as it is now).
 */
function mergePerson(person: ThanksPerson | undefined, sponsor: Sponsor): ThanksPerson {
  const fresh: ThanksPerson = {
    key: sponsor.login,
    login: sponsor.login,
    name: displayNameOf(sponsor),
    avatarUrl: sponsor.avatarUrl,
    url: sponsor.url,
    isCurrent: sponsor.isActive,
    since: sponsor.createdAt,
  };
  if (!person) return fresh;
  // ISO 8601 strings in one zone compare as dates (and Math.min would coerce them to NaN).
  const isLater = sponsor.createdAt >= person.since;
  return {
    ...(isLater ? fresh : person),
    isCurrent: person.isCurrent || sponsor.isActive,
    since: isLater ? person.since : sponsor.createdAt,
  };
}

/** Current first; within each group, whoever began first. ISO strings compare as dates. */
function byThanksOrder(a: ThanksPerson, b: ThanksPerson): number {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  if (a.since === b.since) return 0;
  return a.since < b.since ? -1 : 1;
}

/**
 * What the thank-you row shows: `unavailable` when the data is null (GitHub failed or missed
 * the deadline), `none` when nobody listable has ever sponsored, else one entry per person.
 */
export function thanksOf(data: GitHubSponsorsData | null): SponsorsThanks {
  if (data === null) return { state: 'unavailable' };
  const people = new Map<string, ThanksPerson>();
  for (const sponsor of data.sponsors.filter(isListable)) {
    people.set(sponsor.login, mergePerson(people.get(sponsor.login), sponsor));
  }
  if (people.size === 0) return { state: 'none' };
  const ordered = [...people.values()].sort(byThanksOrder);
  return {
    state: 'thanks',
    people: ordered,
    currentCount: ordered.filter((person) => person.isCurrent).length,
  };
}

/**
 * The line under "Thank you", over the names. With nobody sponsoring now, every name below is a
 * past sponsor, so it says that and leads into them (a line ending "None right now." read as if
 * the name under it were nobody).
 */
export function thanksLine(currentCount: number): string {
  return currentCount > 0
    ? 'To everyone sponsoring this work, now and before.'
    : 'No one sponsors right now. Past sponsors:';
}
