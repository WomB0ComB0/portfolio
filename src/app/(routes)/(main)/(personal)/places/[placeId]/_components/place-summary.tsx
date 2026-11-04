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
import { FiX } from 'react-icons/fi';
import { PlaceCategoryBadge } from '@/app/(routes)/(main)/(personal)/places/_components/place-category-badge';
import { PlaceDateRange } from '@/app/(routes)/(main)/(personal)/places/_components/place-date-range';
import { Button } from '@/components/ui/button';

interface PlaceSummaryProps {
  name: string;
  category: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  /** Accessible name of the close link back to /places. */
  closeLabel: string;
}

/** The place page's header: everything the list card shortens, in full. */
export function PlaceSummary({
  name,
  category,
  description,
  startDate,
  endDate,
  closeLabel,
}: PlaceSummaryProps) {
  return (
    <div className="space-y-3">
      {/* Only the title shares a row with the close link, so the rest gets the full width. */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{name}</h1>
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/places" aria-label={closeLabel}>
            <FiX className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PlaceCategoryBadge category={category} />
        <PlaceDateRange
          startDate={startDate}
          endDate={endDate}
          className="text-sm text-muted-foreground"
        />
      </div>
      {description && (
        <p className="max-w-3xl text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
  );
}
