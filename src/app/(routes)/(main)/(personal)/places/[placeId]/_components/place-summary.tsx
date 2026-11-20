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

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { PlaceDateRange } from '@/app/(routes)/(main)/(personal)/places/_components/place-date-range';
import { PageShell } from '@/components/console/page-shell';

interface PlaceSummaryProps {
  name: string;
  category: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  children: ReactNode;
}

/** An ordinary journal page: the visit's context, a real way back, then the photographs. */
export function PlaceSummary({
  name,
  category,
  description,
  startDate,
  endDate,
  children,
}: PlaceSummaryProps) {
  return (
    <PageShell
      sizing="container"
      className="pb-8"
      title={name}
      eyebrow={
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>{category}</span>
          <PlaceDateRange startDate={startDate} endDate={endDate} className="tabular-nums" />
        </span>
      }
      description={description}
      actions={
        <Link
          href="/places"
          prefetch={false}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 tile-label text-muted-foreground no-underline shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-surface-1 hover:text-foreground"
        >
          <FiArrowLeft aria-hidden="true" />
          Back to Places
        </Link>
      }
    >
      {children}
    </PageShell>
  );
}
