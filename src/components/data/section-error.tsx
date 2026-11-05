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
 * @file The designed "this section failed" block. Server-safe on purpose (no 'use client', no
 * hooks), so a server component can render it for a failed loader and a client error boundary
 * can render it as its fallback.
 */

import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Shown when the caller gives no description. */
export const SECTION_ERROR_DESCRIPTION =
  'Something went wrong while loading this section. Try again in a moment.';

export interface SectionErrorProps {
  /** What failed, in words, e.g. "Couldn't load top tracks". */
  title: string;
  /**
   * One short muted line under the title. Words for a visitor: never the raw error message, a
   * status code or JSON.
   */
  description?: ReactNode;
  /** An optional control under the description, e.g. a RetryButton. */
  action?: ReactNode;
  /** The heading's level in the page outline. */
  headingLevel?: 2 | 3;
  className?: string;
}

/**
 * A bordered block naming the section that failed, with an optional action. It takes no error on
 * purpose, so it cannot print one.
 */
export function SectionError({
  title,
  description = SECTION_ERROR_DESCRIPTION,
  action,
  headingLevel = 3,
  className,
}: SectionErrorProps): ReactElement {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('rounded-xl border border-border bg-card/40 p-6', className)}>
      <Heading className="font-semibold text-base text-foreground">{title}</Heading>
      <div className="mt-1 text-muted-foreground text-sm">{description}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
