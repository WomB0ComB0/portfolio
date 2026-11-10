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
 * @file Draws a link-preview card (src/lib/og/cards.tsx) as a 1200x630 PNG with next/og, in the
 * site's Geist faces. Shared by the site card routes (opengraph-image, twitter-image) and the
 * page card route (/api/og), all on the Node runtime, which reads the faces from disk.
 */

import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import { OG_IMAGE_SIZE } from './constants';
import { loadOgFonts } from './fonts';

/** `card` as a 1200x630 PNG response. Rejects when the faces cannot be read. */
export async function renderOgCard(card: ReactElement): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  return new ImageResponse(card, { ...OG_IMAGE_SIZE, fonts: [...fonts] });
}
