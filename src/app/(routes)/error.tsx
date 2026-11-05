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
 * @fileoverview The error boundary for every page under (routes).
 *
 * An error.tsx renders inside the layout of its own segment, so a failed page shows its error
 * view inside the persistent shell: the nav, command palette and footer stay usable. Failures of
 * the shell itself still reach src/app/error.tsx and global-error.tsx.
 */

import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { type JSX, useEffect, useTransition } from 'react';
import { RouteErrorView } from '@/app/_components/errors';

/** What Next passes to a segment's error boundary. */
interface RouteErrorProps {
  /**
   * What the page threw. Errors from server rendering arrive as an Error with a digest; a client
   * component can throw any value, so it is narrowed before reading a digest.
   */
  readonly error: unknown;
  /** Clears the boundary and renders the page again from what the router already has. */
  readonly reset: () => void;
}

/** The digest Next attaches to errors thrown during server rendering, if there is one. */
const digestOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return undefined;
  const { digest } = error;
  return typeof digest === 'string' && digest !== '' ? digest : undefined;
};

/**
 * Shows the in-shell error view for a page that failed, reports client-side errors to Sentry, and
 * retries by fetching the page again from the server.
 */
export default function RouteError({ error, reset }: RouteErrorProps): JSX.Element {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  // Error boundaries swallow what they catch, so Sentry's global handler never sees it. Errors
  // with a digest come from server rendering and were already reported by onRequestError.
  useEffect(() => {
    if (!digestOf(error)) Sentry.captureException(error);
  }, [error]);

  // Refetch the route's server payload, then clear the boundary, in one transition: the error
  // view stays up (with the button busy) until the new payload is ready, instead of re-rendering
  // the cached payload that just failed.
  const onRetry = (): void => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return <RouteErrorView onRetry={onRetry} isRetrying={isRetrying} digest={digestOf(error)} />;
}
