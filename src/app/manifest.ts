import type { MetadataRoute } from 'next/types';

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

import { app } from '@/constants';
import { THEME_COLOR } from '@/utils';

/**
 * @file /manifest.webmanifest: the site as an installable app, in the Live Console palette.
 *
 * - Identity: the site's name and positioning line, a stable id, and the whole site as its scope.
 * - Colours: the canvas for the theme and the splash screen (THEME_COLOR, theme-color.test.ts).
 * - Icons: the wolf mark in the palette (src/lib/og/wolf-mark.tsx), as a scalable SVG, 192 and
 *   512 px PNGs, and maskable PNGs that fill to the edge with the mark inside the safe circle.
 * - Shortcuts: one per current section, each with its page's own description (checked against
 *   the pages' metadata in page-og-url.test.ts) and the nav's glyph for it.
 * - Screenshots: production pages captured at 1280x800 (wide) and 390x844 at 2x (narrow), for
 *   Chrome's richer install dialog. Where Mike is was hidden for the capture: it follows the
 *   Studio setting, which a screenshot cannot.
 *
 * No service worker: public/sw.js only retires the one older builds registered.
 */

/** Edge's side panel width, which Next's manifest type does not list. */
type SiteManifest = MetadataRoute.Manifest & {
  readonly edge_side_panel?: { readonly preferred_width?: number };
};

type ManifestIcon = NonNullable<MetadataRoute.Manifest['icons']>[number];
type ManifestShortcut = NonNullable<MetadataRoute.Manifest['shortcuts']>[number];
type ManifestScreenshot = NonNullable<MetadataRoute.Manifest['screenshots']>[number];

/** The install description: the hero's positioning line, then what the site holds. */
export const MANIFEST_DESCRIPTION = `${app.tagline} Projects, experience, certifications, places and live stats.`;

const ICONS: readonly ManifestIcon[] = [
  { src: '/pwa/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/** A shortcut to `url`, with the 96 px glyph icon drawn for it in public/pwa/shortcuts. */
const shortcut = (
  url: string,
  name: string,
  shortName: string,
  description: string,
  icon: string,
): ManifestShortcut => ({
  name,
  short_name: shortName,
  url,
  description,
  icons: [{ src: `/pwa/shortcuts/${icon}.png`, sizes: '96x96', type: 'image/png' }],
});

/** The current sections, in the order Android shows the first few. */
const SHORTCUTS: readonly ManifestShortcut[] = [
  shortcut(
    '/projects',
    'Projects',
    'Projects',
    'Explore my portfolio of web development, machine learning, and software projects',
    'projects',
  ),
  shortcut(
    '/places',
    'Places',
    'Places',
    'Explore the locations I have visited, including hackathons, tech events, and more',
    'places',
  ),
  shortcut(
    '/places/photos',
    'Place Photos',
    'Photos',
    'Photos from the hackathons, conferences, offices and events I have visited',
    'photos',
  ),
  shortcut(
    '/certifications',
    'Certifications',
    'Certs',
    'View my professional certifications and credentials',
    'certifications',
  ),
  shortcut(
    '/guestbook',
    'Guestbook',
    'Guestbook',
    'Sign my guestbook and leave a message!',
    'guestbook',
  ),
  shortcut(
    '/stats',
    'Stats',
    'Stats',
    "What I'm up to on Discord right now, plus GitHub, LeetCode, coding-time and typing stats that refresh every few hours.",
    'stats',
  ),
];

/** A WebP screenshot of production in public/pwa/screenshots. */
const screenshot = (
  name: string,
  sizes: string,
  formFactor: 'narrow' | 'wide',
  label: string,
): ManifestScreenshot => ({
  src: `/pwa/screenshots/${name}.webp`,
  sizes,
  type: 'image/webp',
  form_factor: formFactor,
  label,
});

const SCREENSHOTS: readonly ManifestScreenshot[] = [
  screenshot(
    'home-wide',
    '1280x800',
    'wide',
    'The home page: a live readout of what Mike is up to',
  ),
  screenshot('projects-wide', '1280x800', 'wide', 'Projects: every project in one index'),
  screenshot('home-narrow', '780x1688', 'narrow', 'The home page on a phone'),
  screenshot('places-narrow', '780x1688', 'narrow', 'Places on a phone: the map of past visits'),
];

/** The web app manifest Next serves at /manifest.webmanifest. */
export default function manifest(): SiteManifest {
  return {
    id: '/',
    name: app.name,
    short_name: app.name,
    description: MANIFEST_DESCRIPTION,
    lang: 'en-US',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    // The page background, like the theme-color tag, so the splash screen matches the page.
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    categories: ['portfolio', 'technology'],
    icons: [...ICONS],
    shortcuts: [...SHORTCUTS],
    screenshots: [...SCREENSHOTS],
    edge_side_panel: { preferred_width: 480 },
    prefer_related_applications: false,
  };
}
