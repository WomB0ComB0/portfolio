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
 * @file A small spinner that shows while the next/link around it is navigating.
 */

import { useLinkStatus } from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

export interface LinkPendingProps {
  className?: string;
}

/**
 * Spins while the enclosing link's navigation is pending; invisible otherwise. Decorative, so it
 * is hidden from assistive technology.
 *
 * It must be rendered inside a next/link: useLinkStatus reads the nearest Link, and anywhere else
 * `pending` stays false, so a misplaced spinner never shows. Detail routes have no loading.tsx
 * (a Suspense boundary above them would answer 200 before notFound() runs), so this spinner is
 * the feedback for a click on a card that opens one.
 *
 * @example
 * <Link href={`/projects/${slug}`}>
 *   {title} <LinkPending />
 * </Link>
 */
export function LinkPending({ className }: LinkPendingProps): ReactElement {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending ? '' : undefined}
      className={cn(
        'inline-block size-3 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-0 transition-opacity data-[pending]:opacity-100 motion-safe:data-[pending]:animate-spin',
        className,
      )}
    />
  );
}
