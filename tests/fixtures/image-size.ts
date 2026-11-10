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
 * @file The pixel size of a PNG or WebP from its header, so tests can check that an image is the
 * size its manifest or metadata entry declares without an image library. PNG: the IHDR chunk.
 * WebP: the lossy (VP8), lossless (VP8L) or extended (VP8X) header.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** An image's format and pixel size, plus whether a PNG has an alpha channel. */
export interface ImageInfo {
  readonly format: 'png' | 'webp';
  readonly width: number;
  readonly height: number;
  /** PNG colour types 4 and 6 carry alpha; every other PNG is opaque. Always true for WebP. */
  readonly hasAlpha: boolean;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads a 24-bit little-endian integer, as VP8X stores its canvas size. */
const uint24 = (bytes: Buffer, offset: number): number =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);

/** The size in a WebP's first chunk, or throws for a chunk it does not know. */
function webpInfo(bytes: Buffer): ImageInfo {
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return {
      format: 'webp',
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
      hasAlpha: true,
    };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return {
      format: 'webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      hasAlpha: true,
    };
  }
  if (chunk === 'VP8X') {
    return {
      format: 'webp',
      width: uint24(bytes, 24) + 1,
      height: uint24(bytes, 27) + 1,
      hasAlpha: true,
    };
  }
  throw new Error(`unknown WebP chunk ${JSON.stringify(chunk)}`);
}

/** The format and size of a PNG or WebP held in `bytes`; throws for anything else. */
export function imageInfo(bytes: Buffer): ImageInfo {
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const colourType = bytes[25];
    return {
      format: 'png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      hasAlpha: colourType === 4 || colourType === 6,
    };
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return webpInfo(bytes);
  }
  throw new Error('not a PNG or WebP');
}

/** The image at a public URL path such as '/pwa/icon-192.png', read from public/. */
export function publicImageInfo(urlPath: string): ImageInfo {
  return imageInfo(readFileSync(join(process.cwd(), 'public', urlPath)));
}
