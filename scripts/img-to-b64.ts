#!/usr/bin/env bun
// -*- typescript -*-

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

import { $ } from 'bun';
import sharp from 'sharp';

sharp.cache(false);

/**
 * Generates a base64-encoded Low-Quality Image Placeholder (LQIP) for a given image source.
 * The LQIP is resized to the specified dimensions and returned as a data URL.
 *
 * @async
 * @author AI Assistant
 * @since 1.0.0
 * @version 1.0.0
 * @web This function generates a web-ready base64 data URL, suitable for `src` attributes of `img` tags.
 * @see {@link https://sharp.pixelplumbing.com/api-resize | sharp.resize documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs | Data URLs}
 *
 * @param {string} src - The file path to the source image (e.g., 'path/to/image.webp').
 * @param {number} width - The desired width for the resized LQIP in pixels.
 * @param {number} height - The desired height for the resized LQIP in pixels.
 *
 * @returns {Promise<{ src: string; lqip: string }>} A promise that resolves to an object containing:
 *   - `src`: The original image's base name (e.g., 'image' from 'path/to/image.webp'), useful as an identifier.
 *   - `lqip`: The base64-encoded data URL of the low-quality image placeholder (e.g., `data:image/webp;base64,...`).
 *
 * @throws {Error} If the file specified by `src` cannot be read, or if `sharp` encounters an error during image processing.
 *
 * @example
 * ```typescript
 * // Generate an LQIP for 'my-image.webp' with dimensions 20x15 pixels.
 * const result = await generateLazyImage('public/assets/images/my-image.webp', 20, 15);
 * console.log(result.src); // 'my-image'
 * console.log(result.lqip); // 'data:image/webp;base64,... (base64 string of the LQIP)'
 * ```
 */
const generateLazyImage = async (
  src: string,
  width: number,
  height: number,
): Promise<{
  src: string;
  lqip: string;
}> => {
  const body = await Bun.file(src).arrayBuffer();

  const sharpImage = sharp(body);
  const metadata = await sharpImage.metadata();
  const format = metadata.format;

  const lqipBuf = await sharpImage.resize({ width, height, fit: 'inside' }).toBuffer();

  const lqip = `data:image/${format};base64,${lqipBuf.toString('base64')}`;

  return {
    src: src.split('/').pop()?.split('.')[0] ?? 'unknown',
    lqip,
  };
};

/**
 * @class ImageToB64
 * @description
 * A utility class designed to manage and generate low-quality image placeholders (LQIP)
 * for a collection of images using predefined dimensions. It provides a convenient
 * interface to the `generateLazyImage` function.
 *
 * @author AI Assistant
 * @since 1.0.0
 * @version 1.0.0
 * @see {@link generateLazyImage} for the underlying LQIP generation logic.
 */
class ImageToB64 {
  /**
   * @private
   * @readonly
   * @type {number}
   * @description The default width in pixels to be used when generating LQIPs for images.
   */
  private readonly width: number;
  /**
   * @private
   * @readonly
   * @type {number}
   * @description The default height in pixels to be used when generating LQIPs for images.
   */
  private readonly height: number;

  /**   * @private
   * @readonly
   * @type {string[]}
   * @description An array of file paths to the images managed by this instance.
   */
  readonly images: string[];

  /**
   * @public
   * @description Creates an instance of the ImageToB64 class.
   * @param {string[]} images - An array of file paths to the images to be processed by this instance.
   * @param {number} width - The default width in pixels to use for generated LQIPs.
   * @param {number} height - The default height in pixels to use for generated LQIPs.
   */
  constructor(images: string[], width: number, height: number) {
    this.images = images;
    this.width = width;
    this.height = height;
  }

  /**
   * @public
   * @async
   * @description Generates a low-quality image placeholder (LQIP) for a single specified image.
   * This method utilizes the `generateLazyImage` function with the `width` and `height`
   * configured during the class instance creation.
   *
   * @param {string} image - The file path to the image for which to generate the LQIP.
   *
   * @returns {Promise<{ src: string; lqip: string }>} A promise that resolves to an object containing:
   *   - `src`: The original image's base name (without path or extension).
   *   - `lqip`: The base64-encoded data URL of the low-quality image placeholder.
   *
   * @throws {Error} If the image file cannot be read or processed by `sharp`.
   *
   * @example
   * ```typescript
   * // Create an instance for processing images with 20x15 pixel LQIPs.
   * const imageProcessor = new ImageToB64(['path/to/img.webp'], 20, 15);
   * // Generate an LQIP for a specific image using the instance's dimensions.
   * const lqipData = await imageProcessor.generateLazyImage('path/to/another-img.webp');
   * console.log(lqipData.lqip); // 'data:image/webp;base64,...'
   * ```
   * @see {@link generateLazyImage} for the core logic of LQIP generation.
   */
  async generateLazyImage(image: string): Promise<{ src: string; lqip: string }> {
    return await generateLazyImage(image, this.width, this.height);
  }
}

// This block executes when the script is run directly from the command line.
// JSDoc is not applied to this top-level script execution logic as it's not a reusable module component.
if (require.main === module) {
  const [directory, dimensions] = process.argv.slice(2);
  const [width, height] = dimensions?.split('x').map(Number) ?? [0, 0];

  if (!width || !height) {
    console.error('Usage: bun script.ts <directory> <width>x<height>');
    process.exit(1);
  }

  if (!directory || !dimensions || Number.isNaN(width) || Number.isNaN(height)) {
    console.error('Usage: bun script.ts <directory> <width>x<height>');
    process.exit(1);
  }

  const images = (await $`find public/assets/images/${directory} -name '*.webp'`.text())
    .split('\n')
    .filter(Boolean);

  if (images.length === 0) {
    console.error('No images found in the directory');
    process.exit(1);
  }

  for (const image of images) {
    const imageToB64 = new ImageToB64([image], width, height);
    try {
      const lqip = await imageToB64.generateLazyImage(image);
      console.log(lqip);
    } catch (error) {
      console.error(error);
    }
  }
}
