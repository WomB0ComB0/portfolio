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

import 'server-only';

/**
 * @file The site's page metadata with the place Location in Studio names, for the root layout
 * (every page: geo.placename) and the home page (also a keyword). Server only: it reads the
 * Sanity settings cache, which constructMetadata (in @/utils, shared with the client) cannot.
 *
 * The place follows the setting exactly as the hero's role line does, with no built-in value
 * (owner decision: 'Clear the field in Studio to hide it'): a cleared location, settings this
 * server has not loaded yet, settings that cannot be read or are older than the cache's TTL
 * (Sanity failing) all name no place. It never waits: metadata that awaited Sanity would hold
 * the <head> for crawlers that get blocking metadata, and once it missed the shell flush every
 * tag (the title included) would stream into the body. So it reads only what this server cached
 * (peekSiteLocation), and the home page's hero is what fills that cache.
 */

import type { Metadata } from 'next';
import { ensureBaseError } from '@/classes/error';
import { reportApiFailure } from '@/lib/observability/report';
import { peekSiteLocation } from '@/lib/sanity/loaders';
import { constructMetadata, type MetadataOptions } from '@/utils/seo/meta';

/**
 * The place Location in Studio names right now, or null for none (see the file comment). Never
 * throws: a failure to read the settings is reported and names no place.
 */
export function siteLocationNow(): string | null {
  try {
    return peekSiteLocation();
  } catch (error) {
    reportApiFailure(ensureBaseError(error, 'seo:site-location'), {
      context: 'site location metadata',
    });
    return null;
  }
}

/** constructMetadata(options) with the place Location names right now, when it names one. */
export function siteMetadata(options: Omit<MetadataOptions, 'location'> = {}): Metadata {
  return constructMetadata({ ...options, location: siteLocationNow() });
}
