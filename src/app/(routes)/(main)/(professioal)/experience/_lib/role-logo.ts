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
 * @file A role's logo URL, built on the server for both experience pages, so no client code
 * loads the Sanity client. List marks retain their 96px square crop. The detail header requests
 * the whole asset at 336px (three times its 112px display), without an authored or square crop.
 * next/image serves the sized image through the site (CSP img-src is 'self').
 */

import type { Experience } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';

const LOGO_SOURCE_PX = 96;
const DETAIL_SOURCE_PX = 336;

export interface RoleLogoOptions {
  readonly variant?: 'list' | 'detail';
}

/** The experience's logo URL, or null for the monogram. */
export function roleLogoOf(
  experience: Experience,
  { variant = 'list' }: RoleLogoOptions = {},
): string | null {
  if (!experience.logo?.asset) return null;
  if (variant === 'detail') {
    try {
      return (
        urlFor(experience.logo.asset).width(DETAIL_SOURCE_PX).fit('max').auto('format').url() ||
        null
      );
    } catch {
      return null;
    }
  }
  return (
    urlFor(experience.logo)
      .width(LOGO_SOURCE_PX)
      .height(LOGO_SOURCE_PX)
      .fit('crop')
      .auto('format')
      .url() || null
  );
}
