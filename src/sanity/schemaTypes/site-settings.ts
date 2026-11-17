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
 * @file The site settings: one document, with the fixed id {@link SITE_SETTINGS_ID}, that holds
 * the home hero's location and tagline. Identity/contact values are static in
 * src/constants/profile.ts; legacy contact fields remain read-only for reference. Studio
 * opens it as a single item and cannot create or delete another (structure.ts).
 *
 * Every field is optional. The tagline uses its built-in value when empty or invalid, so a
 * missing or half-filled document never breaks the page. Legacy contacts no longer override
 * the shared profile; their stored values remain visible for reference.
 * The location is the exception: it has no built-in value (owner decision: 'Clear the field in
 * Studio to hide it'), so clearing it hides it from the hero's role line and from the pages'
 * metadata (geo.placename and the home page's keywords, src/lib/seo/site-metadata.ts), and the
 * site never shows one Studio does not set.
 * Studio and the site's decoder share validation rules (../site-settings-rules.ts). Legacy
 * contact problems are warnings: read-only fields must never block a location/tagline update.
 *
 * Relative imports only: the Studio's own build does not resolve the app's '@/' alias.
 */

import { type CustomValidatorResult, defineField, defineType, type UrlRule } from 'sanity';
import {
  hasText,
  isSiteEmail,
  SITE_BLANK_TEXT_MESSAGE,
  SITE_EMAIL_MESSAGE,
  SITE_LOCATION_MAX_LENGTH,
  SITE_TAGLINE_MAX_LENGTH,
} from '../site-settings-rules';

/** The document type's name. */
export const SITE_SETTINGS_TYPE = 'siteSettings';
/** The one settings document's _id. */
export const SITE_SETTINGS_ID = 'siteSettings';

/** The tagline falls back to the shared static positioning line when unset. */
const WHEN_EMPTY = 'Leave it empty to show the site’s built-in value.';
const LEGACY_CONTACT =
  'Legacy value, kept for reference. It no longer changes the site. Edit src/constants/profile.ts and deploy to update shared identity/contact links.';

/**
 * A Studio rule from one of the site's checks: an empty field passes (the site shows its
 * built-in value, or for the location none), any other value must pass `accepts`, else `message`
 * is an error with `code`. Clearing a field in Studio unsets it, so the owner can always clear one.
 */
const siteRule =
  (accepts: (value: string) => boolean, code: string, message: string) =>
  (value: unknown): CustomValidatorResult =>
    typeof value !== 'string' || accepts(value) ? true : { message, code };

const notBlank = siteRule(hasText, 'custom.site-text-blank', SITE_BLANK_TEXT_MESSAGE);
const siteEmail = siteRule(isSiteEmail, 'custom.site-email', SITE_EMAIL_MESSAGE);

/**
 * The links need no rule of their own: Studio's https-only URI check already refuses what the
 * site's (isSiteHttpsUrl) does, credentials and relative links included. Legacy fields warn
 * instead of blocking Publish because their old values cannot be edited here.
 */
const httpsOnly = (rule: UrlRule): UrlRule => rule.uri({ scheme: ['https'] }).warning();

export const siteSettingsType = defineType({
  name: SITE_SETTINGS_TYPE,
  title: 'Site settings',
  type: 'document',
  fields: [
    // Optional, with no built-in value: clearing it hides it. Spaces only are still refused, so
    // a cleared field is unset, never text that only looks empty.
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description:
        'Optional. Shown after your current role at the top of the home page, in muted text, e.g. "New York, NY", and named in the site\'s search metadata. Clear it to hide your location from the home page and the site\'s metadata.',
      validation: (rule) => rule.max(SITE_LOCATION_MAX_LENGTH).custom(notBlank),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      description: `Your one-line pitch, under your name and current role on the home page. At most ${SITE_TAGLINE_MAX_LENGTH} characters. ${WHEN_EMPTY}`,
      validation: (rule) => rule.max(SITE_TAGLINE_MAX_LENGTH).custom(notBlank),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'email',
      readOnly: true,
      description: LEGACY_CONTACT,
      validation: (rule) => rule.custom(siteEmail).warning(),
    }),
    defineField({
      name: 'githubUrl',
      title: 'GitHub profile URL',
      type: 'url',
      readOnly: true,
      description: LEGACY_CONTACT,
      validation: httpsOnly,
    }),
    defineField({
      name: 'linkedinUrl',
      title: 'LinkedIn profile URL',
      type: 'url',
      readOnly: true,
      description: LEGACY_CONTACT,
      validation: httpsOnly,
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Site settings' }),
  },
});
