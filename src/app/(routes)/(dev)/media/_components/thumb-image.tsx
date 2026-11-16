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
 * @file A feed still's image, with the one thing the server cannot do: when the image fails (a
 * removed video, a dead cover, an optimizer error) it gives way to the fallback (the kind's glyph
 * on surface-2) instead of the browser's broken-image icon. next/image replays an error that
 * happened before hydration, so a still that failed early is caught too.
 */

import Image from 'next/image';
import { type ReactElement, type ReactNode, useState } from 'react';

import { THUMB_IMAGE_CLASS } from './feed-classes';

export interface ThumbImageProps {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** One of the first rows: loads at once. */
  readonly eager: boolean;
  /** Shown in the image's place once it has failed. */
  readonly fallback: ReactNode;
}

/** The still's image (decorative: the title beside it names the row), or its fallback. */
export function ThumbImage({ src, width, height, eager, fallback }: ThumbImageProps): ReactElement {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      sizes={`${width}px`}
      loading={eager ? 'eager' : 'lazy'}
      className={THUMB_IMAGE_CLASS}
      onError={() => setFailed(true)}
    />
  );
}
