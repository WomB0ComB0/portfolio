/**
 * Copyright 2025 Mike Odnis
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
 * @file The Ledger's display helpers, applied at the edge (nothing is written back to Sanity):
 * issuer strings folded into companies, the joined skill strings the CMS holds split apart,
 * months formatted from the string alone (Sanity holds the 1st of a month, so a day is never
 * shown, and nothing goes through Date, so no time zone can shift a month), and credential URLs
 * kept only when they lead somewhere safe. Pure and server-safe; the filter island shares it.
 */

/** Issuer strings, as written on credentials, that belong to one company. Any other string is a company of its own. */
export const ISSUER_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  Google: [
    'Google',
    'Google Cloud Skills Boost',
    'Google Cloud Training Online',
    'Google Digital Academy (Skillshop)',
  ],
  Microsoft: ['Microsoft', 'Microsoft Learn Student Ambassadors'],
};

const FAMILY_BY_ISSUER: ReadonlyMap<string, string> = new Map(
  Object.entries(ISSUER_FAMILIES).flatMap(([family, issuers]) =>
    issuers.map((issuer) => [issuer, family] as const),
  ),
);

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const SANITY_MONTH = /^(\d{4})-(\d{2})(?:-\d{2})?$/;
const NO_BREAK_SPACE = ' ';
/** What separates the skills the CMS stores joined in one string. */
const SKILL_SEPARATORS = /[\n•·]/;

export interface Month {
  /** 'Dec': a row inside its year's group, where the year bar already says the year. */
  readonly name: string;
  /** 'Dec 2024': rows, tiles and chips. */
  readonly short: string;
  /**
   * 'December 2024': the header's "since". A no-break space joins the month to its year, so a
   * narrow subline never ends a line on the month and drops the year to a line of its own.
   */
  readonly long: string;
  /** '2024-12': a <time> element's dateTime. */
  readonly iso: string;
  readonly year: string;
}

export interface CredentialLink {
  readonly href: string;
  /** The destination's host without www. */
  readonly host: string;
  /** The platform a visitor lands on ('Coursera', 'Credly'), or the host when it is not known: what the Verify column and the phone meta show. */
  readonly platform: string;
}

/** The platforms credentials are hosted on, by host (without www). Any other host shows as itself. */
export const CREDENTIAL_PLATFORMS: Readonly<Record<string, string>> = {
  'coursera.org': 'Coursera',
  'credly.com': 'Credly',
  'linkedin.com': 'LinkedIn',
  'cloudskillsboost.google': 'Skills Boost',
  'udemy.com': 'Udemy',
  'sololearn.com': 'Sololearn',
  'api2.sololearn.com': 'Sololearn',
  'learn.mongodb.com': 'MongoDB',
  'skillshop.credential.net': 'Skillshop',
  'credsverse.com': 'Credsverse',
  'digitalcredential.stanford.edu': 'Stanford',
  'learn.microsoft.com': 'Microsoft Learn',
  'university.atlassian.com': 'Atlassian',
  'certificate.algoexpert.io': 'AlgoExpert',
  'freecodecamp.org': 'freeCodeCamp',
  'virtualbadge.io': 'VirtualBadge',
  'mindluster.com': 'MindLuster',
  'storage.googleapis.com': 'Google',
};

/** The company an issuer string belongs to: a folded family, or the trimmed string itself. */
export function familyOf(issuer: string): string {
  const trimmed = issuer.trim();
  return FAMILY_BY_ISSUER.get(trimmed) ?? trimmed;
}

/** A name as a URL slug: lower case, runs of anything else as one hyphen. */
export function slugOf(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

/** The certificate's skills, joined strings split, blanks and repeats (ignoring case) dropped. */
export function skillsOf(cert: { readonly skills?: readonly string[] | null }): readonly string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const part of (cert.skills ?? []).flatMap((skill) => skill.split(SKILL_SEPARATORS))) {
    const skill = part.trim();
    const key = skill.toLowerCase();
    if (skill === '' || seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
  }
  return skills;
}

/** The month of a Sanity date ('2024-12-01' or '2024-12'), read from the string alone. */
export function monthOf(date: string | null | undefined): Month | null {
  const match = SANITY_MONTH.exec(date ?? '');
  if (!match) return null;
  const [, year = '', mm = ''] = match;
  const long = MONTHS_LONG[Number(mm) - 1];
  if (!long) return null;
  return {
    name: long.slice(0, 3),
    short: `${long.slice(0, 3)} ${year}`,
    long: `${long}${NO_BREAK_SPACE}${year}`,
    iso: `${year}-${mm}`,
    year,
  };
}

/** An http(s) credential URL to link, with its host; null for anything that leads nowhere safe. */
export function credentialLinkOf(url: string | null | undefined): CredentialLink | null {
  const trimmed = url?.trim() ?? '';
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const host = new URL(trimmed).host.replace(/^www\./, '');
    return {
      href: trimmed,
      host,
      platform: Object.hasOwn(CREDENTIAL_PLATFORMS, host)
        ? (CREDENTIAL_PLATFORMS[host] ?? host)
        : host,
    };
  } catch {
    return null;
  }
}

/** '1 certificate', '26 certificates'. */
export const countLabel = (count: number): string =>
  `${count} ${count === 1 ? 'certificate' : 'certificates'}`;
