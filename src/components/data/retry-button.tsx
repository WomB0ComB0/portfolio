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
 * @file Try again for a section that a server component rendered as failed: it re-renders the
 * route on the server (router.refresh), so the section's loader runs again.
 */

import { useRouter } from 'next/navigation';
import { type ReactElement, type ReactNode, useTransition } from 'react';

import { Button } from '@/components/ui/button';

export interface RetryButtonProps {
  /** Runs first, before the refresh starts, e.g. to reset a client query. */
  onRetry?: () => void;
  children?: ReactNode;
}

/** Refreshes the current route. Disabled and aria-busy until the refreshed payload arrives. */
export function RetryButton({ onRetry, children = 'Try again' }: RetryButtonProps): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const retry = (): void => {
    onRetry?.();
    startTransition(() => router.refresh());
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={retry}
      disabled={isPending}
      aria-busy={isPending || undefined}
    >
      {children}
    </Button>
  );
}
