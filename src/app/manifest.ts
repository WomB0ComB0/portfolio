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

/**
 * Extends the base screenshot type from Next.js MetadataRoute.Manifest with additional form factor property
 * @typedef {Object} ExtendedScreenshot
 * @property {string} src - Source URL of the screenshot image
 * @property {string} sizes - Dimensions of the screenshot in format "widthxheight"
 * @property {string} type - MIME type of the image (e.g. "image/png")
 * @property {'narrow' | 'wide'} [form_factor] - Optional form factor indicating if screenshot is for narrow/mobile or wide/desktop views
 */
/**
 * Extended manifest type that overrides screenshots array with ExtendedScreenshot type
 * @typedef {Object} ExtendedManifest
 * @extends {Omit<MetadataRoute.Manifest, 'screenshots'>}
 * @property {ExtendedScreenshot[]} [screenshots] - Array of screenshots with optional form factor property
 */
export type ExtendedManifest = Omit<MetadataRoute.Manifest, 'screenshots'> & {
  screenshots?: Array<{
    src: string;
    sizes: string;
    type: string;
    form_factor?: 'narrow' | 'wide';
  }>;
  tab_strip?: {
    [key: string]: {
      url: string;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    };
  };

  launch_handler?: {
    client_mode: 'auto' | 'focus-existing' | 'navigate-existing' | 'navigate-new';
    navigate_existing_client?: 'always' | 'never';
  };

  edge_side_panel?: {
    preferred_width?: number;
  };

  file_handlers?: Array<{
    action: string;
    accept: Record<string, string[]>;
    launch_type?: 'single-client' | 'multiple-clients';
  }>;

  protocol_handlers?: Array<{
    protocol: string;
    url: string;
    title?: string;
  }>;

  share_target?: {
    action: string;
    method: string;
    enctype?: string;
    params?: {
      title?: string;
      text?: string;
      url?: string;
      files?: Array<{
        name: string;
        accept: string[];
      }>;
    };
  };

  note_taking?: {
    new_note_url: string;
  };
};

export default function manifest(): ExtendedManifest {
  return {
    name: 'Mike Odnis',
    short_name: 'MO',
    description: app.description,
    categories: [...app.keywords],
    lang: 'en-US',
    dir: 'ltr',
    id: '/',
    start_url: '/',
    scope: '/',
    theme_color: '#BA9BDD',
    background_color: '#560BAD',
    orientation: 'portrait-primary',
    display_override: ['minimal-ui', 'browser', 'fullscreen', 'window-controls-overlay'],
    display: 'standalone',
    share_target: {
      action: '/',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        title: 'Check out this portfolio!',
        text: 'I found this portfolio really interesting.',
        url: 'https://mikeodnis.dev',
      },
    },

    edge_side_panel: {
      preferred_width: 480,
    },
    protocol_handlers: [
      {
        protocol: 'web+mikeodnis',
        url: '/?url=%s',
      },
    ],
    launch_handler: {
      client_mode: 'auto',
      navigate_existing_client: 'always',
    },
    icons: [
      {
        src: '/assets/svgs/logo.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-100.png',
        sizes: '71x71',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-100.webp',
        sizes: '71x71',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-125.png',
        sizes: '89x89',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-125.webp',
        sizes: '89x89',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-150.png',
        sizes: '107x107',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-150.webp',
        sizes: '107x107',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-200.png',
        sizes: '142x142',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-200.webp',
        sizes: '142x142',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-400.png',
        sizes: '284x284',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-400.webp',
        sizes: '284x284',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-100.png',
        sizes: '150x150',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-100.webp',
        sizes: '150x150',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-125.png',
        sizes: '188x188',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-125.webp',
        sizes: '188x188',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-150.png',
        sizes: '225x225',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-150.webp',
        sizes: '225x225',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-200.png',
        sizes: '300x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-200.webp',
        sizes: '300x300',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-400.png',
        sizes: '600x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-400.webp',
        sizes: '600x600',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-100.png',
        sizes: '310x150',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-100.webp',
        sizes: '310x150',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-125.png',
        sizes: '388x188',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-125.webp',
        sizes: '388x188',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-150.png',
        sizes: '465x225',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-150.webp',
        sizes: '465x225',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-200.png',
        sizes: '620x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-200.webp',
        sizes: '620x300',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-400.png',
        sizes: '1240x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-400.webp',
        sizes: '1240x600',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-100.png',
        sizes: '310x310',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-100.webp',
        sizes: '310x310',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-125.png',
        sizes: '388x388',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-125.webp',
        sizes: '388x388',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-150.png',
        sizes: '465x465',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-150.webp',
        sizes: '465x465',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-200.png',
        sizes: '620x620',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-200.webp',
        sizes: '620x620',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-400.png',
        sizes: '1240x1240',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-400.webp',
        sizes: '1240x1240',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-100.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-100.webp',
        sizes: '44x44',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-125.png',
        sizes: '55x55',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-125.webp',
        sizes: '55x55',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-150.png',
        sizes: '66x66',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-150.webp',
        sizes: '66x66',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-200.png',
        sizes: '88x88',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-200.webp',
        sizes: '88x88',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-400.png',
        sizes: '176x176',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-400.webp',
        sizes: '176x176',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-100.png',
        sizes: '50x50',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-100.webp',
        sizes: '50x50',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-125.png',
        sizes: '63x63',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-125.webp',
        sizes: '63x63',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-150.png',
        sizes: '75x75',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-150.webp',
        sizes: '75x75',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-200.png',
        sizes: '100x100',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-200.webp',
        sizes: '100x100',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-400.png',
        sizes: '200x200',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-400.webp',
        sizes: '200x200',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-100.png',
        sizes: '620x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-100.webp',
        sizes: '620x300',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-125.png',
        sizes: '775x375',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-125.webp',
        sizes: '775x375',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-150.png',
        sizes: '930x450',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-150.webp',
        sizes: '930x450',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-200.png',
        sizes: '1240x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-200.webp',
        sizes: '1240x600',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-400.png',
        sizes: '2480x1200',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-400.webp',
        sizes: '2480x1200',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-16.webp',
        sizes: '16x16',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-20.webp',
        sizes: '20x20',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-24.webp',
        sizes: '24x24',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-30.webp',
        sizes: '30x30',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-32.webp',
        sizes: '32x32',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-36.webp',
        sizes: '36x36',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-40.webp',
        sizes: '40x40',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-44.webp',
        sizes: '44x44',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-48.webp',
        sizes: '48x48',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-60.webp',
        sizes: '60x60',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-64.webp',
        sizes: '64x64',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-72.webp',
        sizes: '72x72',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-80.webp',
        sizes: '80x80',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-96.webp',
        sizes: '96x96',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-256.webp',
        sizes: '256x256',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-16.webp',
        sizes: '16x16',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-20.webp',
        sizes: '20x20',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-24.webp',
        sizes: '24x24',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-30.webp',
        sizes: '30x30',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-32.webp',
        sizes: '32x32',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-36.webp',
        sizes: '36x36',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-40.webp',
        sizes: '40x40',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-44.webp',
        sizes: '44x44',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-48.webp',
        sizes: '48x48',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-60.webp',
        sizes: '60x60',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-64.webp',
        sizes: '64x64',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-72.webp',
        sizes: '72x72',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-80.webp',
        sizes: '80x80',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-96.webp',
        sizes: '96x96',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-256.webp',
        sizes: '256x256',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-16.webp',
        sizes: '16x16',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-20.webp',
        sizes: '20x20',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-24.webp',
        sizes: '24x24',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-30.webp',
        sizes: '30x30',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-32.webp',
        sizes: '32x32',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-36.webp',
        sizes: '36x36',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-40.webp',
        sizes: '40x40',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-44.webp',
        sizes: '44x44',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-48.webp',
        sizes: '48x48',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-60.webp',
        sizes: '60x60',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-64.webp',
        sizes: '64x64',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-72.webp',
        sizes: '72x72',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-80.webp',
        sizes: '80x80',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-96.webp',
        sizes: '96x96',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-256.webp',
        sizes: '256x256',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-512-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-512-512.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-192-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-192-192.webp',
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-144-144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-96-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-96-96.webp',
        sizes: '96x96',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-72-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-72-72.webp',
        sizes: '72x72',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/android/android-launchericon-48-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/16.webp',
        sizes: '16x16',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/20.webp',
        sizes: '20x20',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/29.png',
        sizes: '29x29',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/29.webp',
        sizes: '29x29',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/40.webp',
        sizes: '40x40',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/50.png',
        sizes: '50x50',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/50.webp',
        sizes: '50x50',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/57.png',
        sizes: '57x57',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/57.webp',
        sizes: '57x57',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/58.png',
        sizes: '58x58',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/60.webp',
        sizes: '60x60',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/64.webp',
        sizes: '64x64',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/72.webp',
        sizes: '72x72',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/76.png',
        sizes: '76x76',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/76.webp',
        sizes: '76x76',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/80.webp',
        sizes: '80x80',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/87.png',
        sizes: '87x87',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/87.webp',
        sizes: '87x87',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/100.png',
        sizes: '100x100',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/100.webp',
        sizes: '100x100',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/114.png',
        sizes: '114x114',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/114.webp',
        sizes: '114x114',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/120.png',
        sizes: '120x120',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/120.webp',
        sizes: '120x120',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/152.webp',
        sizes: '152x152',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/167.png',
        sizes: '167x167',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/167.webp',
        sizes: '167x167',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/180.webp',
        sizes: '180x180',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/192.webp',
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/256.webp',
        sizes: '256x256',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/512.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/1024.webp',
        sizes: '1024x1024',
        type: 'image/webp',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Home',
        short_name: 'Home',
        url: '/',
        description: 'Learn more about Mike Odnis, his background, and interests.',
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Stats Dashboard',
        short_name: 'Stats',
        url: '/stats',
        description: "View Mike's current projects, skills, and activity at a glance.",
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Guest Book',
        short_name: 'Book',
        url: '/guestbook',
        description: "Leave a message or see what others have said about Mike's portfolio.",
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Places',
        short_name: 'Places',
        url: '/places',
        description: 'Discover the locations Mike has visited or plans to explore.',
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Resume',
        short_name: 'Resume',
        url: '/resume',
        description: "View Mike's professional experience, skills, and achievements.",
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Spotify',
        short_name: 'Spotify',
        url: '/spotify',
        description: "Check out Mike's music preferences and current listening habits.",
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: "Mike's Blogs",
        short_name: 'Blog',
        url: '/blog',
        description: "Read Mike's latest thoughts and updates on his blog.",
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Sponsor',
        short_name: 'Sponsor',
        url: '/hire',
        description: 'Contact Mike to discuss your project or needs.',
        icons: [
          {
            src: '/assets/svgs/logo-small.svg',
            type: 'image/svg+xml',
            purpose: 'any',
            sizes: '96x96',
          },
        ],
      },
    ],
    screenshots: [
      {
        src: '/assets/images/screen-shot-narrow.png',
        sizes: '640x1136',
        type: 'image/png',
        form_factor: 'narrow',
      },
      {
        src: '/assets/images/screen-shot-wide.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    prefer_related_applications: false,
  } as const satisfies ExtendedManifest;
}
