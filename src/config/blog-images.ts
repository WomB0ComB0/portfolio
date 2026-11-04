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
 * Where Hashnode post covers are served from, in `images.remotePatterns` format.
 *
 * next.config.ts adds these to `images.remotePatterns`, and the blog API keeps a Hashnode cover
 * only when it matches one of them, so every cover it returns can be loaded through next/image.
 *
 * Kept free of imports so next.config.ts can load it directly.
 */
export const HASHNODE_COVER_PATTERNS = [
  // Cover and custom Open Graph images uploaded to Hashnode.
  { protocol: 'https', hostname: 'cdn.hashnode.com' },
  // Title cards Hashnode generates for posts without a custom Open Graph image.
  { protocol: 'https', hostname: 'blog.mikeodnis.dev', pathname: '/api/og/**' },
] as const;
