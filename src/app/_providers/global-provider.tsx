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

'use client';

import { WebVitals } from '@/app/_components';
import { PageTransition } from '@/components/animations';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Analytics } from '@vercel/analytics/react';
import { KBarProvider } from 'kbar';
import type React from 'react';
import { useEffect } from 'react';

import { actions } from '@/lib/navigation';
import { Events, Providers, ThemeProvider } from '@/providers';
import { TailwindIndicator } from '@/providers/core';
import { createQueryClient } from '@/providers/server';
import { logger } from '@/utils';

/**
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#root-layout | Next.js Root Layout}
 * @see {@link https://tanstack.com/query/latest/docs/react/overview | TanStack Query}
 * @see {@link https://kbar.dev/ | KBar}
 * @see {@link https://vercel.com/docs/analytics | Vercel Analytics}
 *
 * `GlobalProvider` is a root-level component that composes all necessary React context providers
 * and global functionalities for the application. It ensures that all child components have access
 * to themes, query clients, event systems, command palette, and other essential services.
 *
 * It also handles global side effects like cursor hydration fixes and offline detection.
 *
 * @param {Readonly<{ children: React.ReactNode }>} props - The properties for the GlobalProvider component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the providers.
 * @returns {React.JSX.Element} The rendered application wrapped with all global providers and components.
 */
export const GlobalProvider: React.FC<
  Readonly<{
    children: React.ReactNode;
  }>
> = ({ children }) => {
  /**
   * @private
   * @web
   * @description
   * Sets up an event listener for the browser's 'offline' event.
   * If the user goes offline, it redirects them to a dedicated '/offline' page.
   * The event listener is cleaned up when the component unmounts.
   */
  useEffect(() => {
    /**
     * @private
     * @web
     * @description
     * Handles the 'offline' event, redirecting the user to the '/offline' page
     * if the browser detects a loss of network connection.
     */
    const handleOffline = () => {
      if (!navigator.onLine) {
        logger.info('Offline');
        window.location.href = '/offline';
      }
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    <>
      {/*
       * @public
       * @description
       * Composes multiple React context providers into a single tree.
       * Each provider supplies specific context (e.g., theme, events, query client)
       * to the components nested within it.
       */}
      <Providers
        providers={[
          /**
           * @public
           * @description Provides an event system context for global event handling.
           */
          [Events, {}],
          /**
           * @public
           * @description Provides theme context for managing light/dark mode and other theme-related settings.
           */
          [ThemeProvider, {}],
          /**
           * @public
           * @description Provides the KBar command palette context, enabling global keyboard shortcuts and commands.
           * @param {KBarActions} actions - An array of actions available in the KBar command palette.
           */
          [KBarProvider, { actions: actions }],
          /**
           * @public
           * @description Provides the TanStack Query client context for efficient data fetching, caching, and state management.
           * @param {QueryClient} client - The TanStack Query client instance created by `createQueryClient()`.
           */
          [QueryClientProvider, { client: createQueryClient() }],
        ]}
      >
        {/*
         * @public
         * @description Wraps the main content with a page transition animation component.
         */}
        <PageTransition>{children}</PageTransition>
        {/*
         * @public
         * @description Component for reporting Web Vitals metrics.
         */}
        <WebVitals />
        {/*
         * @public
         * @description Vercel Analytics component for tracking website usage.
         */}
        <Analytics />
        {/*
         * @public
         * @description A development-only indicator to show the active Tailwind CSS breakpoint.
         */}
        <TailwindIndicator />
        {/*
         * @public
         * @description TanStack Query Devtools for debugging and inspecting query states.
         * @param {boolean} initialIsOpen - Controls whether the devtools panel is initially open.
         */}
        <ReactQueryDevtools initialIsOpen={false} />
      </Providers>
    </>
  );
};

/**
 * @public
 * @readonly
 * @description Display name for the GlobalProvider component, useful for debugging.
 */
GlobalProvider.displayName = 'GlobalProvider';
/**
 * @public
 * @description Exports the GlobalProvider component for use in the application's root layout.
 */
export default GlobalProvider;
