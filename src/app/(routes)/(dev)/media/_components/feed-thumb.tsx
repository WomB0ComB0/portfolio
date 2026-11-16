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
 * @file A feed row's small 16:9 still, server-safe: the YouTube frame, the post's cover or the
 * Sanity art, through next/image (same-origin, so the page CSP's img-src holds), or the kind's
 * glyph on surface-2 when there is none or it fails to load (thumb-image.tsx, the one client
 * piece). A folded stream's still is a stack with its part count;
 * a video that plays in place carries a small play disc. Decorative (alt=""): the title beside it
 * names the row.
 */

import type { ReactElement } from 'react';
import type { IconType } from 'react-icons';
import { FiBookOpen, FiFileText, FiMic, FiMonitor, FiPlay, FiRadio } from 'react-icons/fi';

import type { FeedKind, FeedRow } from '../_lib/media-feed';
import {
  THUMB_CLASS,
  THUMB_COUNT_CLASS,
  THUMB_GLYPH_CLASS,
  THUMB_PLAY_CLASS,
  THUMB_STACK_CLASS,
} from './feed-classes';
import { ThumbImage } from './thumb-image';

/** The still's box at its widest (a 40rem page), for next/image's intrinsic size. */
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;

/** Each kind's glyph for a row without an image. */
const GLYPHS: Readonly<Record<FeedKind, IconType>> = {
  video: FiPlay,
  stream: FiRadio,
  post: FiFileText,
  talk: FiMic,
  presentation: FiMonitor,
  article: FiBookOpen,
};

export interface FeedThumbProps {
  readonly row: FeedRow;
  /** Whether the row's link opens the in-page player (embed, a video). */
  readonly playsHere: boolean;
  /** The first rows' stills load at once; the rest when near. */
  readonly eager: boolean;
}

/** The still, or the stack of stills for a folded stream. */
export function FeedThumb({ row, playsHere, eager }: FeedThumbProps): ReactElement {
  const Glyph = GLYPHS[row.kind];
  const stacked = row.parts.length > 1;
  const glyph = <Glyph aria-hidden="true" className={THUMB_GLYPH_CLASS} />;
  const still = (
    <span data-feed-thumb="" className={THUMB_CLASS}>
      {row.thumb ? (
        <ThumbImage
          src={row.thumb}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
          eager={eager}
          fallback={glyph}
        />
      ) : (
        glyph
      )}
      {playsHere && (
        <span aria-hidden="true" className={THUMB_PLAY_CLASS}>
          <FiPlay className="size-3 translate-x-px" />
        </span>
      )}
      {stacked && (
        <span aria-hidden="true" className={THUMB_COUNT_CLASS}>
          {row.parts.length}
        </span>
      )}
    </span>
  );
  return stacked ? <span className={THUMB_STACK_CLASS}>{still}</span> : still;
}
