'use client';

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

import { QueryClientContext } from '@tanstack/react-query';
import { KBarContext } from 'kbar';
import { type ReactNode, useContext } from 'react';
import { ServiceStatusLink } from './service-status-link';

/**
 * Ordinary unmatched URLs keep the site shell. Next's server-action 404 fallback renders the
 * root not-found without the root layout, so neither the palette nor the footer's query context
 * exists there. Read the contexts before mounting those consumers, and keep that fallback usable
 * without the root stylesheet or client router as well.
 */
export function RootNotFoundShell({ children }: { readonly children: ReactNode }) {
  const kbar = useContext(KBarContext);
  const queryClient = useContext(QueryClientContext);

  if (typeof kbar.getState === 'function' && typeof kbar.subscribe === 'function' && queryClient) {
    return children;
  }

  return (
    <main
      style={{
        minHeight: '100svh',
        boxSizing: 'border-box',
        display: 'grid',
        placeContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        colorScheme: 'light dark',
        background: 'Canvas',
        color: 'CanvasText',
      }}
    >
      <h1 style={{ margin: 0 }}>Page not found</h1>
      <p style={{ margin: 0 }}>This page doesn&apos;t exist, or it moved.</p>
      <nav
        aria-label="Recovery"
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem' }}
      >
        <a href="/" style={{ color: 'inherit' }}>
          Home
        </a>
        <a href="/projects" style={{ color: 'inherit' }}>
          Projects
        </a>
        <ServiceStatusLink style={{ color: 'inherit' }} />
      </nav>
    </main>
  );
}
