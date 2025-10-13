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
    const fontData = await fetch(new URL('/assets/fonts/Kodchasan-Bold.ttf', getURL()))
      .then((res) => {
        if (!res.ok) {
          console.error(`Font loading failed: ${res.status} ${res.statusText}`);
          throw new Error(`Failed to load font: ${res.status}`);
        }
        return res.arrayBuffer();
      })
      .catch(() => {
        console.warn('Failed to load Kodchasan font, falling back to system font');
        return null;
      });
    return new ImageResponse(
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
      </div>,
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
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response('Failed to generate the image', {
      status: 500,
    });
  }
}
