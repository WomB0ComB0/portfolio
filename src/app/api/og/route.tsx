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

import { app } from '@/constants';
import { constructMetadata, logger } from '@/utils';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs'; // explicit, since you use fs.readFile

// Cache the font loading across invocations in the same container
const fontDataPromise = Promise.all([
  readFile(join(process.cwd(), 'public', 'assets', 'fonts', 'Kodchasan-Bold.ttf')),
  readFile(join(process.cwd(), 'public', 'assets', 'fonts', 'Kodchasan-Regular.ttf')),
]);

const Logo = () => (
  <div aria-hidden="true" style={{ marginLeft: '20px', width: 60, height: 60 }}>
    <svg
      width="60"
      height="60"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ marginLeft: '20px', width: 60, height: 60 }}
    >
      <title>Mike Odnis logo</title>
      <g
        transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
        fill="#8b5cf6"
        stroke="#d6b3f0"
      >
        <path d="M945 5057 c-35 -17 -45 -55 -45 -167 0 -59 -4 -187 -10 -286 -5 -98 -15 -305 -21 -459 -6 -154 -14 -347 -18 -430 l-6 -150 -84 -48 c-46 -26 -109 -62 -140 -79 -31 -17 -69 -39 -86 -48 -16 -9 -57 -32 -90 -50 -72 -40 -100 -66 -108 -100 -7 -29 -12 -49 -67 -240 -23 -80 -45 -158 -50 -175 -5 -16 -27 -95 -50 -175 -23 -80 -45 -158 -50 -175 -5 -16 -13 -46 -19 -65 -24 -77 -4 -130 49 -130 12 0 39 -4 59 -10 20 -5 133 -28 251 -50 118 -23 227 -43 242 -46 15 -3 30 -9 33 -14 3 -4 -9 -39 -26 -76 -17 -38 -40 -89 -51 -114 -11 -25 -36 -78 -54 -118 -19 -41 -34 -84 -34 -97 0 -46 12 -48 292 -44 l263 4 76 -190 c42 -104 81 -201 87 -215 47 -119 95 -239 103 -255 5 -11 38 -94 74 -185 36 -91 70 -174 75 -185 5 -11 28 -67 50 -124 22 -57 46 -109 54 -116 7 -7 35 -23 62 -35 27 -12 63 -27 79 -35 17 -7 75 -32 130 -55 94 -40 149 -63 220 -95 17 -7 75 -32 130 -55 127 -53 156 -66 232 -102 l63 -30 72 35 c40 20 96 44 123 55 28 11 76 32 107 46 31 14 59 26 62 26 3 0 34 13 68 29 35 16 101 44 148 64 47 19 115 49 153 66 37 17 70 31 73 31 12 0 99 43 110 55 8 7 32 59 54 116 22 57 45 113 50 124 5 11 28 67 50 125 23 58 46 114 50 125 5 11 39 94 75 185 36 91 70 174 75 185 5 11 23 56 40 100 17 44 35 89 39 100 5 11 15 34 21 50 7 17 24 59 39 95 l27 65 262 -4 c280 -4 292 -2 292 44 0 13 -15 56 -34 97 -18 40 -43 93 -54 118 -11 25 -34 76 -51 114 -17 37 -28 72 -26 77 3 4 22 11 43 15 36 6 379 72 492 94 92 19 105 29 104 80 0 25 -8 70 -16 100 -37 125 -101 347 -108 375 -5 17 -27 95 -50 175 -53 185 -60 210 -67 239 -11 43 -32 58 -289 202 -28 15 -89 50 -135 76 l-84 48 -6 150 c-4 83 -14 328 -23 545 -8 217 -18 411 -20 430 -3 19 -6 97 -7 173 -1 147 -8 177 -48 195 -62 29 -70 26 -345 -155 -105 -69 -276 -181 -381 -250 -104 -69 -323 -212 -485 -318 -162 -106 -308 -203 -323 -215 -43 -34 -106 -38 -142 -8 -30 24 -64 46 -375 250 -96 63 -249 163 -340 223 -91 60 -230 151 -310 203 -80 52 -194 128 -255 167 -60 40 -127 82 -148 94 -40 22 -88 25 -122 8z m333 -444 c8 -12 200 -149 767 -548 226 -159 430 -304 454 -322 24 -18 50 -33 58 -33 13 0 1229 853 1282 899 13 12 32 21 41 21 20 0 65 -21 68 -32 2 -4 5 -13 7 -20 3 -7 6 -280 8 -606 l2 -594 155 -80 c85 -43 216 -111 291 -149 108 -55 139 -75 147 -97 15 -38 184 -565 186 -577 0 -5 -33 -13 -74 -17 -79 -7 -347 -35 -465 -48 -75 -8 -109 -15 -125 -25 -21 -13 -8 -72 50 -217 33 -83 60 -157 60 -165 0 -10 -40 -13 -198 -13 -196 0 -199 0 -210 -22 -10 -20 -90 -238 -112 -308 -5 -14 -27 -77 -50 -140 -23 -63 -46 -126 -50 -140 -4 -14 -27 -77 -50 -140 -23 -63 -52 -146 -65 -185 -13 -38 -42 -122 -65 -185 -23 -63 -47 -130 -53 -149 -13 -38 -33 -51 -152 -101 -44 -18 -105 -44 -135 -58 -30 -13 -83 -37 -117 -53 -34 -16 -91 -40 -125 -55 -35 -14 -82 -35 -105 -45 -23 -10 -47 -19 -52 -19 -7 0 -11 45 -11 129 0 144 -2 138 78 193 26 17 78 56 116 87 218 175 270 316 124 335 -24 4 -222 5 -441 4 l-399 -3 -19 -24 c-34 -42 -22 -102 32 -165 61 -72 187 -182 263 -230 16 -10 42 -30 57 -44 l29 -25 0 -129 c0 -85 -4 -128 -11 -128 -6 0 -40 13 -76 30 -35 16 -66 30 -69 30 -2 0 -38 16 -80 35 -41 19 -77 35 -79 35 -2 0 -32 13 -67 29 -35 16 -114 52 -176 79 -62 27 -119 58 -125 68 -7 11 -21 44 -31 74 -10 30 -22 64 -27 75 -4 11 -17 47 -28 80 -11 33 -39 112 -61 175 -23 63 -46 126 -50 140 -5 14 -32 90 -60 170 -29 80 -56 156 -60 170 -5 14 -27 77 -50 140 -23 63 -46 130 -52 148 -5 19 -18 53 -28 78 l-19 44 -201 0 c-162 0 -200 3 -200 14 0 7 27 80 60 162 60 150 71 202 47 223 -15 12 -142 27 -512 61 -143 13 -158 16 -152 27 2 5 44 130 91 278 48 149 92 282 98 297 8 21 39 42 146 96 76 39 207 106 292 150 l155 80 3 600 2 599 25 25 c25 26 80 32 93 11z" />
      </g>
    </svg>
  </div>
);

export async function GET(request: Request): Promise<ImageResponse | Response> {
  const { searchParams } = new URL(request.url);
  const titleParam = searchParams.get('title');
  const descriptionParam = searchParams.get('description');

  const metadata = constructMetadata({});
  const metadataTitle = typeof metadata.title === 'string' ? metadata.title : 'Mike Odnis';

  const title = titleParam || metadataTitle;
  const description = descriptionParam || String(metadata.description);

  try {
    const [kodchasanBoldData, kodchasanRegularData] = await fontDataPromise;

    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0118 0%, #1a0b2e 50%, #160b28 100%)',
          fontFamily: '"Kodchasan"',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Enhanced gradient orbs */}
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            top: '-200px',
            left: '-100px',
            filter: 'blur(80px)',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
            bottom: '-150px',
            right: '-100px',
            filter: 'blur(80px)',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(100px)',
            zIndex: 0,
          }}
        />

        {/* Logo with glow effect */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 10,
            filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.5))',
          }}
        >
          <Logo />
        </div>

        {/* Decorative corner accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '300px',
            height: '300px',
            background: 'linear-gradient(225deg, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
            zIndex: 1,
          }}
        />

        {/* Main content container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            width: '100%',
            padding: '0 80px',
            zIndex: 10,
            marginTop: 40,
            position: 'relative',
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: '80px',
              height: '6px',
              background: 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)',
              borderRadius: '3px',
              marginBottom: 32,
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)',
            }}
          />

          {/* Title with gradient */}
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff 0%, #e9d5ff 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.05,
              marginBottom: 28,
              letterSpacing: '-0.03em',
              maxWidth: '90%',
            }}
          >
            {title}
          </div>

          {/* Description with better contrast */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: '#d8b4fe',
              lineHeight: 1.6,
              maxWidth: '80%',
              opacity: 0.95,
            }}
          >
            {description}
          </div>
        </div>

        {/* Enhanced footer with badge style */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontSize: 22,
            fontWeight: 500,
            zIndex: 10,
            background: 'rgba(168, 85, 247, 0.1)',
            padding: '12px 24px',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.2)',
          }}
        >
          <span
            style={{
              color: '#e9d5ff',
              fontWeight: 600,
            }}
          >
            {app.name}
          </span>
          <span style={{ color: '#8b5cf6', opacity: 0.6 }}>•</span>
          <span style={{ color: '#c4b5fd', opacity: 0.9 }}>
            {app.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Kodchasan',
            data: kodchasanBoldData,
            style: 'normal',
            weight: 700,
          },
          {
            name: 'Kodchasan',
            data: kodchasanRegularData,
            style: 'normal',
            weight: 400,
          },
        ],
      },
    );
  } catch (e) {
    logger.error(`Failed to generate OG image: ${e instanceof Error ? e.message : String(e)}`);
    return new Response('Failed to generate the image', {
      status: 500,
    });
  }
}
