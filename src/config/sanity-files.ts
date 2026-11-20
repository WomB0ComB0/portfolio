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
 * The same-origin path for caption tracks. A `<track>` from another origin would need CORS and a
 * `crossorigin` attribute on the video, so src/components/portfolio-media.tsx points captions at
 * `/assets/sanity-files/<project>/<dataset>/<file>` and next.config.ts rewrites that to the Sanity
 * CDN.
 *
 * The rewrite is pinned to this site's project and dataset and to WebVTT asset files. Any other
 * path under the prefix (another project, another dataset, another file type) matches no rewrite and
 * 404s, so the site cannot be used to serve other Sanity customers' files.
 *
 * Kept free of imports so next.config.ts and the tests can load it directly.
 */

export const SANITY_FILES_PATH_PREFIX = '/assets/sanity-files';

/** A Sanity file asset is named by the SHA-1 of its contents (40 lower-case hex) and extension. */
const CAPTIONS_FILE_PATTERN = '[0-9a-f]{40}\\.vtt';

/** Sanity project ids are lower-case letters and digits. */
const PROJECT_ID = /^[a-z0-9]{1,32}$/u;

/** Sanity dataset names: lower-case letters, digits, `_` and `-`, at most 64 characters. */
const DATASET = /^[a-z0-9][a-z0-9_-]{0,63}$/u;

export interface SanityFilesRewrite {
  readonly source: string;
  readonly destination: string;
}

/**
 * The caption-file rewrite for one project and dataset, or `undefined` when either value is not a
 * valid Sanity name. No rewrite means every path under the prefix 404s, so a missing or malformed
 * value fails closed (and can never put path-to-regexp syntax into the route).
 *
 * @example
 * sanityCaptionsRewrite('abc123xy', 'production')
 * // { source: '/assets/sanity-files/abc123xy/production/:file([0-9a-f]{40}\\.vtt)',
 * //   destination: 'https://cdn.sanity.io/files/abc123xy/production/:file' }
 */
export function sanityCaptionsRewrite(
  projectId: string | undefined,
  dataset: string | undefined,
): SanityFilesRewrite | undefined {
  if (!projectId || !dataset || !PROJECT_ID.test(projectId) || !DATASET.test(dataset)) {
    return undefined;
  }
  return {
    source: `${SANITY_FILES_PATH_PREFIX}/${projectId}/${dataset}/:file(${CAPTIONS_FILE_PATTERN})`,
    destination: `https://cdn.sanity.io/files/${projectId}/${dataset}/:file`,
  };
}

/**
 * Response headers for the caption files, applied through next.config.ts `headers()` on the same
 * source as the rewrite. Sanity may record a .vtt upload as text/plain or application/octet-stream,
 * and browsers need text/vtt to parse a track. The CSP keeps the file inert if it is opened as a
 * page; it has no effect on a `<track>` load.
 */
export const SANITY_CAPTIONS_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Content-Type', value: 'text/vtt; charset=utf-8' },
  { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
];
