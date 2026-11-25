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

import { HASHNODE_COVER_PATTERNS } from './blog-images';

/**
 * Hosts the browser may load images from directly, for the CSP img-src list. Not passed to the
 * /_next/image optimizer: next.config.ts gives it no remote patterns, so it relays no host.
 */
export const REMOTE_IMAGE_PATTERNS = [
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  { protocol: 'https', hostname: 'mikeodnis.dev' },
  { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
  { protocol: 'https', hostname: 'github.com' },
  { protocol: 'https', hostname: 'api.lanyard.rest' },
  { protocol: 'https', hostname: 'i.scdn.co' },
  { protocol: 'https', hostname: 'cdn.discordapp.com' },
  { protocol: 'https', hostname: 'cdn.sanity.io' },
  { protocol: 'https', hostname: 'img.youtube.com' },
  { protocol: 'https', hostname: 'res.cloudinary.com' },
  { protocol: 'https', hostname: 'dev-to-uploads.s3.amazonaws.com' },
  { protocol: 'https', hostname: 'media.dev.to' },
  { protocol: 'https', hostname: 'media2.dev.to' },
  // Book covers returned by /api/v1/books/lookup (Open Library & Google Books).
  { protocol: 'https', hostname: 'covers.openlibrary.org' },
  { protocol: 'https', hostname: 'books.google.com' },
  // Hashnode post covers (cdn.hashnode.com and the blog's generated /api/og/** title cards).
  ...HASHNODE_COVER_PATTERNS,
] as const;

export const REMOTE_IMAGE_SOURCES = REMOTE_IMAGE_PATTERNS.map(
  (pattern) =>
    `https://${pattern.hostname}${'pathname' in pattern ? pattern.pathname.replace(/\*\*$/, '') : ''}`,
);
