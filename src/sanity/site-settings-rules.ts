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
 * @file The site settings' rules, in one place for both sides that apply them: the Studio schema
 * (src/sanity/schemaTypes/site-settings.ts) checks them before Publish, and the site's decoder
 * (src/hooks/sanity/schemas.ts) checks them on every read. A value that breaks one is an error in
 * Studio, so the home page never silently drops a published edit.
 *
 * No imports: the Studio's own build loads this by a relative path (it does not resolve the app's
 * '@/' alias), and the decoder loads it wherever the site runs.
 */

/** The longest location, in characters. It sits beside the avatar, in capitals. */
export const SITE_LOCATION_MAX_LENGTH = 40;
/**
 * The longest tagline, in characters: three lines under the hero's name from a 24rem tile, up to
 * five on a phone. The hero reserves that many (TAGLINE_SLOT_RESERVED_CLASS, measured at 120).
 */
export const SITE_TAGLINE_MAX_LENGTH = 120;
/** The longest email address, in characters (RFC 5321's limit on a path). */
export const SITE_EMAIL_MAX_LENGTH = 254;

/**
 * An address a mailto link carries as it is: letters, digits and . _ % + - before the @, then a
 * dotted domain. Narrower than RFC 5322, and than Studio's own email check, on purpose: '?', '&'
 * and '#' would start a query or a fragment in the link.
 */
export const SITE_EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** What Studio says about a location or tagline of spaces only. */
export const SITE_BLANK_TEXT_MESSAGE = 'Leave it empty instead of only spaces';
/** What Studio says about an address {@link isSiteEmail} refuses. */
export const SITE_EMAIL_MESSAGE = 'Use letters, digits and . _ % + - before the @; no ?, & or #';

/** True when `value` has a character other than whitespace: the site trims every field. */
export const hasText = (value: string): boolean => value.trim().length > 0;

/** True for an address the site uses, once trimmed: {@link SITE_EMAIL_PATTERN}, not too long. */
export function isSiteEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= SITE_EMAIL_MAX_LENGTH && SITE_EMAIL_PATTERN.test(email);
}

/**
 * True for a link the site uses, once trimmed: an absolute https URL without credentials. Studio
 * needs no copy of this: its https-only URI check refuses the same links.
 */
export function isSiteHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}
