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

import { ImageResponse } from 'next/og';
/**
 * @module OpenGraph
 * @description Handles dynamic OpenGraph image generation for social media sharing.
 * @web
 * @author Mike Odnis
 * @see {@link https://ogp.me/ Open Graph protocol}
 * @see {@link https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image Open Graph Image API}
 * @version 1.0.0
 */
import { constructMetadata, getURL, logger } from '@/utils';

/**
 * Generates an OpenGraph-compliant image response for embedding in social and messaging platforms.
 *
 * This endpoint processes query parameters to generate a dynamic image containing title and description
 * rendered with a custom Kodchasan font and branded background. Falls back gracefully to system font if unavailable.
 *
 * @async
 * @function GET
 * @param {Request} request - The incoming HTTP request with optional `title` and `description` search params.
 * @returns {Promise<ImageResponse | Response>} Returns an ImageResponse for valid requests, or a Response with a 500 status if image generation fails.
 * @throws {Error} Throws on image or font generation/loading failures.
 * @example
 * // Example Request:
 * // GET /api/og?title=My%20Page&description=My%20Page%20Description
 * // Example Response: An OpenGraph image with the given title and description
 * @web
 * @public
 * @author Mike Odnis
 * @see {@link https://github.com/WomB0ComB0/portfolio portfolio on GitHub}
 * @readonly
 * @version 1.0.0
 */
export async function GET(request: Request): Promise<ImageResponse | Response> {
  const { searchParams } = new URL(request.url);
  const titleParam = searchParams?.get('title');
  const descriptionParam = searchParams?.get('description');

  const metadata = constructMetadata({});
  const metadataTitle =
    typeof metadata.title === 'string'
      ? metadata.title
      : typeof metadata.title === 'object' && metadata.title !== null && 'default' in metadata.title
        ? String(metadata.title.default)
        : 'Mike Odnis';

  const title = titleParam || metadataTitle;
  const description =
    descriptionParam ||
    String(metadata.description || 'Full-stack developer and software engineer');

  try {
    /**
     * Loads the Kodchasan custom font for OpenGraph image rendering.
     * Falls back to system font if loading fails.
     * @type {ArrayBuffer|null}
     * @private
     */
    const fontData = await fetch(new URL('/assets/fonts/Kodchasan-Bold.ttf', getURL()))
      .then((res) => {
        if (!res.ok) {
          logger.error(`Font loading failed: ${res.status} ${res.statusText}`);
          throw new Error(`Failed to load font: ${res.status}`);
        }
        return res.arrayBuffer();
      })
      .catch(() => {
        logger.warn('Failed to load Kodchasan font, falling back to system font');
        return null;
      });

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px',
            backgroundColor: '#0a0a0a',
            backgroundImage: 'linear-gradient(135deg, #234c8b 0%, #0a0a0a 100%)',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 20,
              fontFamily: 'Kodchasan',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#e5e5e5',
              fontFamily: 'Kodchasan',
              lineHeight: 1.4,
              maxWidth: '80%',
            }}
          >
            {description}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        ...(fontData && {
          fonts: [
            {
              name: 'Kodchasan',
              data: fontData,
              style: 'normal',
              weight: 700,
            },
          ],
        }),
      },
    );
  } catch (e) {
    /**
     * Handles rendering or font loading errors.
     * Logs error and returns a 500 error response.
     * @private
     */
    logger.error(`${e instanceof Error ? e.message : String(e)}`);
    return new Response('Failed to generate the image', {
      status: 500,
    });
  }
}
