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
 * loads the Sanity client. One square crop serves the row's 20px mark and anything larger;
 * next/image sizes it down (CSP img-src is 'self', so Sanity's CDN is never hit from the page).
 */

import type { Experience } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';

const LOGO_SOURCE_PX = 96;

/** The experience's logo URL, or null for the monogram. */
export function roleLogoOf(experience: Experience): string | null {
  if (!experience.logo?.asset) return null;
  return (
    urlFor(experience.logo)
      .width(LOGO_SOURCE_PX)
      .height(LOGO_SOURCE_PX)
      .fit('crop')
      .auto('format')
      .url() || null
  );
}
