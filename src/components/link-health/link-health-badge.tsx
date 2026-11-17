'use client';

/**
 * Copyright 2026 Mike Odnis
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

import type { ReactElement } from 'react';
import type { LinkHealthScope } from '@/lib/link-health/types';
import { useLinkHealth } from './use-link-health';

const checkedDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

export interface LinkHealthBadgeProps {
  readonly href: string | null | undefined;
  readonly scope: LinkHealthScope;
  readonly label?: string;
}

/** Supplementary, noninteractive status; never changes the destination or disables its link. */
export function LinkHealthBadge({ href, scope, label }: LinkHealthBadgeProps): ReactElement | null {
  const { url, entry } = useLinkHealth(href, scope);
  if (!url || !entry) return null;
  const date = new Date(entry.checkedAt);
  return (
    <span
      data-link-health={entry.status}
      data-link-health-url={url}
      data-link-health-scope={scope}
      className="relative inline-flex w-fit max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 tile-meta"
    >
      {label && (
        <span className="font-medium text-muted-foreground [overflow-wrap:anywhere]">{label}:</span>
      )}
      <span className="text-down">Unavailable</span>
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <time dateTime={entry.checkedAt} className="text-faint">
        <span aria-hidden="true">Checked {checkedDate.format(date)} UTC</span>
        <span className="sr-only">. Last checked {date.toUTCString()}.</span>
      </time>
    </span>
  );
}
