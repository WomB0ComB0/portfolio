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
 * @file /opengraph-image: the site card, the home page's link preview and the default for the
 * site's own tags (src/lib/og/cards.tsx), drawn at build time with next/og on the Node runtime.
 *
 * Every page's metadata sets its own preview image, so Next never adds this file's tag itself:
 * constructMetadata (src/utils/seo/meta.ts) links it by SITE_CARD_PATH instead.
 */

import type { ImageResponse } from 'next/og';
import { SiteCard } from '@/lib/og/cards';
import { OG_CONTENT_TYPE, OG_IMAGE_SIZE, siteCardAlt } from '@/lib/og/constants';
import { renderOgCard } from '@/lib/og/render';

export const alt = siteCardAlt();
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The site card as a 1200x630 PNG. */
export default function OpenGraphImage(): Promise<ImageResponse> {
  return renderOgCard(<SiteCard />);
}
