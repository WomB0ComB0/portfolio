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
 * @file Overlapping avatar circles for the /sponsor thank-you row, adapted from Magic UI's Avatar
 * Circles (https://magicui.design/docs/components/avatar-circles, MIT; its notice is below).
 *
 * What changed from the original:
 * - a server component (no 'use client'), so the row is in the HTML without client code;
 * - next/image instead of <img>, sized 40px, alt="" and the whole stack aria-hidden: the visible
 *   names beside it carry the links and the accessible names, so each person is one tab stop;
 * - no per-avatar links and no empty-href "+N" link: the overflow is a plain "+N" circle;
 * - palette only: each circle's ring is the surface it sits on, the "+N" circle is surface-3,
 *   with no white, black or grey literals and no hover state;
 * - an avatar that fails to load is a plain surface-2 circle, not the browser's broken image.
 *
 * Magic UI's licence notice, as the MIT License requires:
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { ReactElement } from 'react';
import Image from '@/components/ui/cdn-image';

import { cn } from '@/lib/utils';

/** How many circles the stack draws before it folds the rest into "+N". */
const AVATAR_LIMIT = 6;

/** Each circle's drawn size in CSS px (size-10); next/image picks the 1x and 2x files from it. */
const AVATAR_PX = 40;

/** A circle's ring is the thank-you tile's own surface, so overlapping circles read as cut out. */
const CIRCLE_CLASS = 'size-10 shrink-0 rounded-full ring-2 ring-surface-1';

/**
 * An avatar's own classes. The `before:` cover is drawn only when the image fails to load (a
 * loaded <img> is a replaced element and has no ::before): it paints the circle's surface over the
 * browser's broken-image glyph, with no client code. Where a browser draws no ::before on a failed
 * image the classes do nothing.
 */
const AVATAR_CLASS = [
  'relative overflow-hidden bg-surface-2 object-cover',
  "before:absolute before:inset-0 before:rounded-full before:bg-surface-2 before:content-['']",
].join(' ');

export interface AvatarCirclesPerson {
  readonly key: string;
  readonly avatarUrl: string;
}

export interface AvatarCirclesProps {
  readonly people: readonly AvatarCirclesPerson[];
  /** Circles drawn before "+N"; AVATAR_LIMIT unless given. */
  readonly limit?: number;
  readonly className?: string;
}

/**
 * The first `limit` avatars, overlapping, then a "+N" circle when there are more. Decorative:
 * whatever renders it must show the names too.
 */
export function AvatarCircles({
  people,
  limit = AVATAR_LIMIT,
  className,
}: AvatarCirclesProps): ReactElement {
  const shown = people.slice(0, limit);
  const rest = people.length - shown.length;
  return (
    <div aria-hidden="true" className={cn('flex -space-x-3 rtl:space-x-reverse', className)}>
      {shown.map((person) => (
        <Image
          key={person.key}
          src={person.avatarUrl}
          alt=""
          width={AVATAR_PX}
          height={AVATAR_PX}
          className={cn(CIRCLE_CLASS, AVATAR_CLASS)}
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            CIRCLE_CLASS,
            'grid place-items-center bg-surface-3 tile-meta text-foreground',
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
