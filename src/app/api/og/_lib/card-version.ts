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
 * @file The `?v=` of a book's or a shelf's link-preview card URL. The page card (/api/og) carries
 * its words in its query, so a changed card is a new URL; a slug-keyed card looks its words up,
 * so this version stands in for them: anything the card draws changes the URL, and the CDN and
 * the link-preview crawlers fetch the new card. Pure and isomorphic (the pages' metadata and the
 * card routes both compute it).
 */

import { shortHash } from '@/app/(routes)/(dev)/media/_lib/media-parts';

/**
 * A short, URL-safe version of `drawn` (FNV-1a of its JSON, base 36). Not a secret and not
 * collision-proof: it only has to change when the card does.
 */
export const cardVersion = (drawn: unknown): string => shortHash(JSON.stringify(drawn) ?? '');
