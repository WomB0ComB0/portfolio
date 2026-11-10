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
 * @file The header's figures with this page's stored posts counted too: the server list's count
 * plus the posts it doesn't have yet, and the first month from them only when the list had none.
 */

import { describe, expect, it } from 'vitest';
import {
  type GuestbookStats,
  withPosted,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/format';
import type { GuestbookMessage } from '@/lib/guestbook/types';

/** A synthetic stored message. */
const at = (id: string, createdAt: string): GuestbookMessage => ({
  id,
  authorName: 'Jane Example',
  message: 'Hello, testing 123',
  createdAt,
});

const POSTED = at('stored-new', '2026-11-09T07:19:00.000Z');

describe('withPosted', () => {
  it('adds the posts to the count and keeps the first month', () => {
    const stats: GuestbookStats = { count: 27, firstMonth: 'Oct 2025' };

    expect(withPosted(stats, [POSTED])).toEqual({ count: 28, firstMonth: 'Oct 2025' });
  });

  it('takes the first month from the earliest post when the list had none', () => {
    const stats: GuestbookStats = { count: 0, firstMonth: null };
    const earlier = at('stored-old', '2026-10-31T23:59:00.000Z');

    expect(withPosted(stats, [POSTED, earlier])).toEqual({ count: 2, firstMonth: 'Oct 2026' });
  });

  it('leaves a capped count as it is', () => {
    const stats: GuestbookStats = { count: '1+', firstMonth: 'Oct 2025' };

    expect(withPosted(stats, [POSTED])).toEqual({ count: '1+', firstMonth: 'Oct 2025' });
  });

  it('leaves the first month empty when no post has a readable date', () => {
    const stats: GuestbookStats = { count: 0, firstMonth: null };

    expect(withPosted(stats, [at('stored-new', 'not a date')])).toEqual({
      count: 1,
      firstMonth: null,
    });
  });

  it('returns the same figures when nothing was posted', () => {
    const stats: GuestbookStats = { count: 27, firstMonth: 'Oct 2025' };

    expect(withPosted(stats, [])).toBe(stats);
  });
});
