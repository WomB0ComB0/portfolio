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

/** Shared authoring/rendering rules; no Studio or server dependencies. */
export const hasMediaText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** External watch links must be absolute HTTP(S), without embedded credentials. */
export function isMediaLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      /^https?:$/u.test(url.protocol) && !url.username && !url.password && value === value.trim()
    );
  } catch {
    return false;
  }
}

/** Only Sanity's file CDN can be a native player/captions source. */
export function isMediaFileUrl(value: string, extensions: readonly string[]): boolean {
  if (!isMediaLink(value)) return false;
  const url = new URL(value);
  return (
    url.origin === 'https://cdn.sanity.io' &&
    /^\/files\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_-]+\/[^/]+$/u.test(url.pathname) &&
    extensions.some((extension) => url.pathname.endsWith(`.${extension}`))
  );
}

export const isMediaImageRef = (value: string): boolean =>
  /^image-[a-zA-Z0-9]+-[1-9]\d*x[1-9]\d*-(?:jpg|jpeg|png|webp|gif|avif)$/u.test(value);

export function isCaptionsLanguage(value: string): boolean {
  try {
    return value.length > 0 && Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

/** Sanity references carry the original format, even before the asset is resolved. */
export function hasMediaFileRef(value: unknown, extensions: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || !('asset' in value)) return false;
  const asset = value.asset;
  if (!asset || typeof asset !== 'object' || !('_ref' in asset) || typeof asset._ref !== 'string')
    return false;
  return extensions.some((extension) =>
    new RegExp(`^file-[a-zA-Z0-9]+-${extension}$`, 'u').test(asset._ref as string),
  );
}

/** Shared Studio object validation, so a half-filled file input never counts as a source. */
export function validateMediaVideo(value: unknown): true | string {
  if (!value || typeof value !== 'object') return true;
  const entry = value as Record<string, unknown>;
  const hasFile = entry.file != null;
  const hasLink = hasMediaText(entry.externalUrl);
  if (hasFile === hasLink) return 'Choose exactly one uploaded video or external watch URL.';
  if (hasFile && !hasMediaFileRef(entry.file, ['mp4', 'webm']))
    return 'Upload an MP4 or WebM video.';
  if (hasLink && !isMediaLink(entry.externalUrl as string))
    return 'Use an absolute HTTP(S) watch URL without credentials.';
  if (entry.captionsFile != null) {
    if (!hasFile)
      return 'Captions files apply to uploaded videos; add captions on the external video host instead.';
    if (!hasMediaFileRef(entry.captionsFile, ['vtt']))
      return 'Upload captions in WebVTT (.vtt) format.';
    if (!hasMediaText(entry.captionsLanguage) || !isCaptionsLanguage(entry.captionsLanguage))
      return 'Set the captions language, for example en or en-US.';
    if (!hasMediaText(entry.captionsLabel))
      return 'Add a readable captions label, for example English.';
  }
  return true;
}

/** Keep authoring formats aligned with the website’s bitmap image renderer. */
export function validateMediaImage(value: unknown): true | string {
  if (value == null) return true;
  if (typeof value !== 'object' || !('asset' in value)) return 'Upload an image.';
  const asset = value.asset;
  return (
    Boolean(
      asset &&
        typeof asset === 'object' &&
        '_ref' in asset &&
        typeof asset._ref === 'string' &&
        isMediaImageRef(asset._ref),
    ) || 'Upload a JPEG, PNG, WebP, GIF or AVIF image.'
  );
}
