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
 * @file Where the link-preview cards live and what they say about the site, shared by the
 * metadata (constructMetadata, which the client bundles too), the card routes and the cards.
 * No Node imports here.
 *
 * `app` is read only inside functions: src/constants/app.ts imports @/utils, which loads
 * constructMetadata and so this module, and a top-level read would meet `app` before it exists.
 */

import { app } from '@/constants';

/** Every card's size: the 1.91:1 frame Open Graph and X's large-image card expect. */
export const OG_IMAGE_SIZE = { width: 1_200, height: 630 } as const;

/** Every card is a PNG. */
export const OG_CONTENT_TYPE = 'image/png';

/** The site card (src/app/opengraph-image.tsx): the home page and the site's own tags. */
export const SITE_CARD_PATH = '/opengraph-image';

/** The same card for X (src/app/twitter-image.tsx). */
export const SITE_TWITTER_CARD_PATH = '/twitter-image';

/** A page's card, drawn from its title and description (src/app/api/og/route.tsx). */
export const PAGE_CARD_PATH = '/api/og';

/**
 * The site card's role line. Fixed rather than the hero's first current role from Studio
 * ('{position}, {company}'), so a cached preview never names a role that has since changed.
 */
export const SITE_ROLE = 'Software engineer';

/** The host the cards print: the canonical domain, whatever deployment draws them. */
export const SITE_HOST = 'mikeodnis.dev';

/** The site card's alt text: who it shows and the positioning line it carries. */
export const siteCardAlt = (): string => `${app.name}, ${SITE_ROLE.toLowerCase()}. ${app.tagline}`;
