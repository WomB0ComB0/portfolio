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
 * @file The site's YouTube channel, named once: the loader that lists its uploads
 * (src/lib/sanity/enrich.ts) and the site's JSON-LD (src/lib/seo/json-ld.ts) both read it here.
 */

/** The channel whose uploads are listed next to the videos stored in Sanity. */
export const YOUTUBE_CHANNEL_HANDLE = '@mikeodnis';

/** The channel's page: youtube.com/@handle. */
export const YOUTUBE_CHANNEL_URL = `https://www.youtube.com/${YOUTUBE_CHANNEL_HANDLE}`;
