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

import { cn } from '@/lib/utils';

interface PlaceCategoryBadgeProps {
  category: string;
  className?: string;
}

/** A place's category as a pill, shared by the list cards and the place page. */
export function PlaceCategoryBadge({ category, className }: PlaceCategoryBadgeProps) {
  return (
    <span
      className={cn(
        // leading-4: the global span rule would otherwise give 12px text a 28px line.
        'rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs leading-4 font-semibold text-primary',
        className,
      )}
    >
      {category}
    </span>
  );
}
