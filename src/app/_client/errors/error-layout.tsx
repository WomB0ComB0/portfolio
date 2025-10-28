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

/**
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/error-handling | Next.js Error Handling}
 *
 * @typedef {object} ErrorLayoutProps
 * @property {string} title - The main title to display on the error page.
 * @property {string} description - A descriptive message explaining the error.
 * @property {Error & { digest?: string }} [error] - The error object, potentially including a digest for identification.
 * @property {() => void} [reset] - A function to reset the error boundary and attempt to re-render the component tree.
 */

/**
 * `ErrorLayout` is a client-side React component designed to display a user-friendly error page.
 * It provides options to try again or navigate back to the home page.
 * The layout includes a prominent error icon, a customizable title and description,
 * and optional display of an error digest.
 *
 * @param {ErrorLayoutProps} props - The properties for the ErrorLayout component.
 * @returns {React.JSX.Element} A React element representing the error layout.
 *
 * @example
 * ```tsx
 * // In an error.tsx file within an App Router route segment
 * 'use client';
 *
 * import { useEffect } from 'react';
 * import { ErrorLayout } from '@/app/_client/errors/error-layout';
 *
 * export default function Error({
 *   error,
 *   reset,
 * }: {
 *   error: Error & { digest?: string };
 *   reset: () => void;
 * }) {
 *   useEffect(() => {
 *     // Log the error to an error reporting service
 *     console.error(error);
 *   }, [error]);
 *
 *   return (
 *     <ErrorLayout
 *       title="Something went wrong!"
 *       description="We're sorry, but an unexpected error occurred. Please try again or go back home."
 *       error={error}
 *       reset={reset}
 *     />
 *   );
 * }
 * ```
 */

import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import type React from 'react';
import { memo } from 'react';

const ErrorLayout: React.FC<{
  title: string;
  description: string;
  error?: Error & { digest?: string };
  reset?: () => void;
}> = memo(
  ({
    title,
    description,
    reset,
    error,
  }: {
    title: string;
    description: string;
    error?: Error & { digest?: string };
    reset?: () => void;
  }): React.JSX.Element => {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4 gap-3">
        <motion.div
          style={{
            zIndex: 10,
            maxWidth: '28rem',
            width: '100%',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            textAlign: 'center',
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-6" />
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-white mb-6 sm:mb-8"
            style={{
              fontFamily: 'Kodchasan, serif',
              textShadow: '0 0 10px rgba(0,0,0,0.2)',
            }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-base text-white/80 mb-10"
            style={{
              fontFamily: 'Kodchasan, serif',
            }}
          >
            {description}
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <Button
              size="lg"
              className="w-full bg-white/10 text-white hover:bg-white/20"
              variant="outline"
              asChild
            >
              <Link
                href="."
                role="button"
                onClick={() => (reset ? reset() : window.location.reload())}
                className="flex items-center justify-center text-white"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Try again
              </Link>
            </Button>
            <Button className="w-full bg-primary text-white hover:bg-primary/90" asChild>
              <Link href="/" className="flex items-center text-white">
                <Home className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Go back home
              </Link>
            </Button>
          </div>
          {error?.digest && <p className="mt-8 text-sm text-white/60">Error ID: {error.digest}</p>}
        </motion.div>
      </div>
    );
  },
);

ErrorLayout.displayName = 'ErrorLayout';
export { ErrorLayout };
