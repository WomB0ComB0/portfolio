'use client';

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

import * as Sentry from '@sentry/nextjs';
import { type CSSProperties, useEffect } from 'react';
import { ServiceStatusLink } from '@/app/_components/errors/service-status-link';
import { profile } from '@/constants/profile';

// The root layout and its CSS/providers may be the failing code. Keep this document native.
const actionStyle: CSSProperties = {
  border: '1px solid currentColor',
  borderRadius: '0.5rem',
  padding: '0.75rem 1rem',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
};

const GlobalError = ({ error, retry }: { error: unknown; retry?: () => void }) => {
  const hasServerDigest =
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest !== '';
  useEffect(() => {
    // An error with a digest was thrown while rendering on the server, where onRequestError
    // already reported it; the browser only gets a redacted copy.
    if (!hasServerDigest) Sentry.captureException(error);
  }, [error, hasServerDigest]);

  return (
    <html lang="en">
      <head>
        <title>{`Something went wrong | ${profile.name}`}</title>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          colorScheme: 'light dark',
          background: 'Canvas',
          color: 'CanvasText',
        }}
      >
        {/* It replaces the root layout, so the page Layout's <main> is not there. */}
        <main
          style={{
            minHeight: '100svh',
            boxSizing: 'border-box',
            display: 'grid',
            placeContent: 'center',
            gap: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}>Something went wrong</h1>
          <p style={{ margin: 0, maxWidth: '40rem', lineHeight: 1.5 }}>
            The site couldn&apos;t load. Try again, or check the service status.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => (retry ? retry() : globalThis.location.reload())}
              style={actionStyle}
            >
              Try again
            </button>
            <a href="/" style={actionStyle}>
              Go back home
            </a>
            <ServiceStatusLink style={actionStyle} />
          </div>
        </main>
      </body>
    </html>
  );
};
GlobalError.displayName = 'GlobalError';
export default GlobalError;
