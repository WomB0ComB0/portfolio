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
 * @fileoverview The "Something went wrong" view a failed page shows inside the site shell.
 *
 * Presentational: no hooks and no state. The route's error boundary owns retrying and reporting,
 * and passes in what to show.
 */

import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Ties the section's accessible name to its heading. */
const TITLE_ID = 'route-error-title';

/** What the error view shows and how its Try again button behaves. */
export interface RouteErrorViewProps {
  /** Loads the page again. */
  readonly onRetry: () => void;
  /** True while a retry is loading: the button is disabled and marked busy. */
  readonly isRetrying?: boolean;
  /** Identifies a server-side error in the logs; shown so a visitor can quote it. */
  readonly digest?: string;
}

/**
 * The page-level error view: a heading, one sentence, Try again and Home. The nav and footer stay
 * around it, since the route's error boundary sits inside the shell.
 *
 * It sets no robots meta. Only visitors' browsers render it: Next keeps the server HTML for bots
 * instead of rendering a segment's error boundary, and crawlers that run no JavaScript never get
 * this far. Keeping a failed page out of search indexes takes server-rendered metadata or a real
 * error status.
 */
export function RouteErrorView({
  onRetry,
  isRetrying = false,
  digest,
}: RouteErrorViewProps): JSX.Element {
  return (
    <section
      aria-labelledby={TITLE_ID}
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 px-6 py-20 text-center sm:py-28"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="mb-3 grid size-14 place-items-center rounded-2xl border border-border bg-card/60 text-muted-foreground shadow-sm"
        >
          <AlertTriangle className="size-6" />
        </span>
        <h1 id={TITLE_ID} className="text-3xl text-foreground sm:text-4xl">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">
          This page didn&apos;t load, but the rest of the site still works.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          aria-busy={isRetrying}
          className={buttonVariants({ size: 'lg' })}
        >
          <RotateCw aria-hidden="true" className={cn(isRetrying && 'motion-safe:animate-spin')} />
          Try again
        </button>
        <Link href="/" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          <Home aria-hidden="true" />
          Home
        </Link>
      </div>

      {digest ? (
        <p className="font-mono text-xs text-muted-foreground">Error ID: {digest}</p>
      ) : null}
    </section>
  );
}
