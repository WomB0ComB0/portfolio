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

import { formatDateRangeParts } from '@/utils';

interface PlaceDateRangeProps {
  startDate?: string | null;
  endDate?: string | null;
  className?: string;
}

/**
 * Renders a place's visit dates as machine-readable <time> elements (one per end of a range),
 * or nothing when the place is undated or the start date is invalid.
 */
export const PlaceDateRange = ({ startDate, endDate, className }: PlaceDateRangeProps) => {
  const parts = formatDateRangeParts(startDate, endDate);
  if (!startDate || !parts) return null;
  return (
    <span className={className}>
      <time dateTime={startDate}>{parts.start}</time>
      {parts.end && endDate && (
        <>
          {/* text-inherit: the global span rule would otherwise colour the dash primary. */}
          <span aria-hidden="true" className="text-inherit">
            {' – '}
          </span>
          <span className="sr-only"> to </span>
          <time dateTime={endDate}>{parts.end}</time>
        </>
      )}
    </span>
  );
};
