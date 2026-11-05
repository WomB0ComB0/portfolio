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

/**
 * @file Keeps a failure inside one section of a page: the section shows SectionError (or the
 * caller's fallback) while the rest of the page and the shell stay.
 */

import {
  type QueryClient,
  QueryClientContext,
  QueryErrorResetBoundary,
  type QueryKey,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Component, type ReactElement, type ReactNode, useContext, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/observability/report';

import { SectionError } from './section-error';

/**
 * Digest prefixes of Next's control-flow errors: notFound(), forbidden() and unauthorized()
 * (NEXT_HTTP_ERROR_FALLBACK;<status>), the older NEXT_NOT_FOUND, and redirect(). They are not
 * failures; Next's own boundaries above this one turn them into a 404 page or a navigation.
 */
const NEXT_CONTROL_FLOW_DIGEST_PREFIXES = [
  'NEXT_HTTP_ERROR_FALLBACK',
  'NEXT_NOT_FOUND',
  'NEXT_REDIRECT',
] as const;

/**
 * The error's digest. Next sets one on every error that comes from the server. An empty digest
 * counts as none, as in RouteError, so such an error is still reported.
 */
function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return undefined;
  const { digest } = error;
  return typeof digest === 'string' && digest !== '' ? digest : undefined;
}

function isNextControlFlowError(error: unknown): boolean {
  const digest = digestOf(error);
  if (digest === undefined) return false;
  return NEXT_CONTROL_FLOW_DIGEST_PREFIXES.some((prefix) => digest.startsWith(prefix));
}

interface SectionErrorBoundaryProps {
  label: string;
  fallback?: ReactNode;
  children: ReactNode;
  /** Lets the section's queries fetch again, then runs `reset` together with a route refresh. */
  retry: (reset: () => void) => void;
  isRetrying: boolean;
}

interface SectionErrorBoundaryState {
  /** Boxed, so a thrown `undefined` or `null` still counts as a failure. */
  failure: { error: unknown } | null;
}

class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { failure: null };

  static getDerivedStateFromError(error: unknown): SectionErrorBoundaryState {
    return { failure: { error } };
  }

  /**
   * Reports client-side failures only. An error with a digest came from the server, where Next's
   * onRequestError hook already reported it.
   */
  componentDidCatch(error: unknown): void {
    if (digestOf(error) !== undefined) return;
    reportError(error, { tags: { section: this.props.label } });
  }

  private readonly reset = (): void => {
    this.setState({ failure: null });
  };

  private readonly handleRetry = (): void => {
    this.props.retry(this.reset);
  };

  render(): ReactNode {
    const { failure } = this.state;
    if (failure === null) return this.props.children;
    // Rethrown to the boundary above, so notFound() and redirect() inside a section still work.
    if (isNextControlFlowError(failure.error)) throw failure.error;
    if (this.props.fallback !== undefined) return this.props.fallback;
    const { isRetrying, label } = this.props;
    return (
      <SectionError
        title={`Couldn't load ${label}`}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            disabled={isRetrying}
            aria-busy={isRetrying || undefined}
          >
            Try again
          </Button>
        }
      />
    );
  }
}

export interface SectionBoundaryProps {
  /** Names the section: the fallback says "Couldn't load <label>", and reports are tagged with it. */
  label: string;
  /** Rendered as is instead of the default SectionError, with no retry. */
  fallback?: ReactNode;
  /**
   * The keys (or key prefixes) of client queries the section renders. Try again resets them
   * first, so a section whose render threw on data it fetched fine fetches that data again,
   * instead of rendering the same cached data (and failing again) until its staleTime runs out.
   */
  queryKeys?: readonly QueryKey[];
  children: ReactNode;
}

/**
 * Clears the section's cached queries. The section is unmounted while its fallback shows, so
 * resetQueries only clears them; the remount fetches. Without a QueryClientProvider there are no
 * client queries to clear.
 */
function resetSectionQueries(
  queryClient: QueryClient | undefined,
  queryKeys: readonly QueryKey[] | undefined,
): void {
  if (queryClient === undefined) return;
  for (const queryKey of queryKeys ?? []) void queryClient.resetQueries({ queryKey });
}

/** SectionBoundary inside its own QueryErrorResetBoundary scope. */
function ScopedSectionBoundary({
  label,
  fallback,
  queryKeys,
  children,
}: SectionBoundaryProps): ReactElement {
  const router = useRouter();
  const queryClient = useContext(QueryClientContext);
  const queryErrors = useQueryErrorResetBoundary();
  const [isRetrying, startTransition] = useTransition();

  // TanStack rethrows a suspense query's cached error on remount until its reset boundary is
  // reset, so the queries are released first; the refresh then covers server-rendered children.
  const retry = (reset: () => void): void => {
    resetSectionQueries(queryClient, queryKeys);
    queryErrors.reset();
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <SectionErrorBoundary label={label} fallback={fallback} retry={retry} isRetrying={isRetrying}>
      {children}
    </SectionErrorBoundary>
  );
}

/**
 * An error boundary for one section. A failure renders "Couldn't load <label>" with Try again,
 * which re-renders the route on the server and then the section, in one transition, so the
 * section re-renders with the refreshed data instead of failing again on the old payload.
 *
 * It also recovers client sections: a suspense query (useSuspenseQuery, useDataLoader) that
 * failed inside it fetches again on Try again, since the boundary resets its own
 * QueryErrorResetBoundary scope (retrying one section does not refetch another) and `queryKeys`.
 *
 * notFound() and redirect() pass through to Next's boundaries. The failure stays until Try again
 * or a remount: give the boundary a `key` that changes with its content (e.g. the active tab) to
 * clear it when the content changes.
 *
 * @example
 * <SectionBoundary label="top tracks" queryKeys={[['spotify', 'top-tracks']]}>
 *   <Suspense fallback={<TracksSkeleton />}>
 *     <TopTracks />
 *   </Suspense>
 * </SectionBoundary>
 */
export function SectionBoundary(props: SectionBoundaryProps): ReactElement {
  return (
    <QueryErrorResetBoundary>
      <ScopedSectionBoundary {...props} />
    </QueryErrorResetBoundary>
  );
}
