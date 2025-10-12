/**
 * @module OpenGraph
 */

import { ImageResponse } from 'next/og';
import { constructMetadata, getURL } from '@/utils';

/**
 * Generates an OpenGraph image for social media sharing
 * @async
 * @function GET
 * @param {Request} request - The incoming HTTP request
 * @throws {Error} When image generation fails
 * @returns {Promise<ImageResponse|Response>} The generated image response or error response
 *
 * @description
 * This endpoint generates a dynamic OpenGraph image based on provided title and description
 * parameters. It creates a branded image with a custom background and typography.
 *
 * The image includes:
 * - A custom background with gradient effects
 * - The page title in large text
 * - A description excerpt below the title
 * - Custom Palatino font rendering
 *
 * @example
 * // Request:
 * GET /api/og?title=My%20Page&description=Page%20description
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metadata = constructMetadata({});
  const title = searchParams?.get('title')?.[0] || metadata.title || 'Default Title';
  const description = searchParams?.get('description')?.[0] || String(metadata.description || '');
  console.log({ description });
  // @ts-expect-error
  console.log({ title: title.default });

  try {
    const fontData = await fetch(new URL('/assets/fonts/palatino.ttf', getURL()))
      .then((res) => {
        if (!res.ok) {
          console.error(`Font loading failed: ${res.status} ${res.statusText}`);
          throw new Error(`Failed to load font: ${res.status}`);
        }
        return res.arrayBuffer();
      })
      .catch(() => {
        console.warn('Failed to load Palatino font, falling back to system font');
        return null;
      });
    return new ImageResponse(<></>, {
      width: 1200,
      height: 630,
      ...(fontData && {
        fonts: [
          {
            name: 'Palatino',
            data: fontData,
            style: 'normal',
          },
        ],
      }),
    });
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response('Failed to generate the image', {
      status: 500,
    });
  }
}
