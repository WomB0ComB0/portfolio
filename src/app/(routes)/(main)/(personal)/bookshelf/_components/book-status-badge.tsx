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

'use client';

/**
 * @file The reading-status badge, used by the controls bar, the book detail, the shelf cards and
 * the reading map. Kept on the palette by tests/unit/bookshelf/palette-only.test.ts.
 */

import type { ReactElement } from 'react';
import { FiBookmark, FiCheck } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { BOOK_STATUS_META, type BookStatus } from '../_lib/books';
import styles from './book-status-badge.module.css';

export interface BookStatusBadgeProps {
  readonly status: BookStatus;
  readonly className?: string;
  readonly 'data-active-status'?: BookStatus;
  readonly 'data-book-status'?: BookStatus;
}

/**
 * A reading status as a pill:
 * - `completed` (Read): a check seal in --brand-ink on --brand-edge, on --brand-subtle.
 * - `reading`: a pulsing --ongoing beacon on --ongoing-tint.
 * - `queued` (Unread): a bookmark outline on --surface-2.
 */
export function BookStatusBadge({
  status,
  className,
  'data-active-status': dataActiveStatus,
  'data-book-status': dataBookStatus,
}: BookStatusBadgeProps): ReactElement {
  return (
    <span
      data-active-status={dataActiveStatus}
      data-book-status={dataBookStatus}
      className={cn(styles['status-badge'], styles[`status-badge-${status}`], className)}
    >
      {status === 'completed' && (
        <span aria-hidden="true" className={styles['status-check-seal']}>
          <FiCheck className="size-2.5 stroke-[3]" />
        </span>
      )}
      {status === 'reading' && (
        <span aria-hidden="true" className={styles['status-beacon']}>
          <span className={styles['status-beacon-ping']} />
          <span className={styles['status-beacon-core']} />
        </span>
      )}
      {status === 'queued' && <FiBookmark aria-hidden="true" className="size-2.5 opacity-80" />}
      <span>{BOOK_STATUS_META[status].label}</span>
    </span>
  );
}
