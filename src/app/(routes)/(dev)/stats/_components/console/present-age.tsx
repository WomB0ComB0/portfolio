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

/**
 * @file Every age on /stats: the kit's Freshness, given a moment never later than the clock it is
 * rendered by.
 *
 * Each age is dated by the server's clock (when a source was read) and worded by the browser's.
 * By a browser clock a minute or more behind the server's, a source read moments ago lies in that
 * clock's future, which formatAge leaves unworded. The Discord tile's age line went empty until
 * its next poll, and a stat tile's context line ended on a separator with nothing after it
 * ('1,022 tests ·'). Clamped, such a moment reads 'just now' and ages from there; a moment the
 * browser's clock has passed is left as it is, so a clock ahead still counts the age its own way.
 */

import type { ReactElement } from 'react';
import { toTime } from '@/components/console/format-age';
import { Freshness, type FreshnessProps } from '@/components/console/freshness';

/**
 * `at` (epoch ms), never later than the clock it is rendered by, read on every render.
 * - On the server this changes nothing: every moment on the page was read before it rendered.
 * - In the browser it applies from the render that hydrates the server HTML, so an age never
 *   blinks empty in between (it did for a frame or more when the clamp waited for hydration to
 *   end). The text and the dateTime may then differ from the server's, which Freshness's <time>
 *   is made for (suppressHydrationWarning, and a layout effect that brings the text up to date).
 * - Every render, not once per moment: after the device clock stepped back, a moment rendered
 *   again unchanged (the Discord tile keeping its read at a poll) lay in that clock's future,
 *   and the line said nothing until a newer read came. A clamped moment is a new moment each
 *   time, so Freshness reads the clock again with it.
 *
 * Between two renders the words follow Freshness's own 30 s tick, which a step back can still
 * leave unworded until the next render (for the Discord line, its next poll).
 */
const noLaterThanNow = (at: number): number => Math.min(at, Date.now());

/**
 * Freshness for a moment read by the server (see the file comment): 'updated just now' rather
 * than nothing by a clock behind it. Renders nothing for a moment that is not one, as Freshness.
 *
 * @example
 * <PresentAge at={figure.updatedAt} className={AGE_CELL_CLASS} />
 */
export function PresentAge({ at, ...rest }: FreshnessProps): ReactElement | null {
  return <Freshness {...rest} at={noLaterThanNow(toTime(at))} />;
}
