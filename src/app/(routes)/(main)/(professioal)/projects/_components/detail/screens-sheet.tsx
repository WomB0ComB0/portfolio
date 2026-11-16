import 'server-only';
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
 * @file The Screens section's pictures, server-rendered, in place of the old sideways-dragging
 * slider. It holds every screen but the cover (the header shows that one), numbered as the viewer
 * numbers them ('Fig. 2' onwards): Folio's justified contact sheet for three or more, a strip of
 * two larger ones, or a single figure. Every row is one height and each screen keeps its own
 * shape (a phone screenshot stays a phone); nothing scrolls sideways. A capture taller than a
 * phone shows its top. Each
 * screen is a link to the whole image that opens the shared viewer, and its caption is Studio's
 * own words ('Fig. 2 · RamHacks sponsorship tiers'), or the figure number alone. Pointing at one
 * dims the others, as the /places photo strip does.
 */

import Image from 'next/image';
import type { CSSProperties, ReactElement } from 'react';

import { PhotoViewerLink } from '@/components/console/photo/photo-viewer';
import styles from './case-body.module.css';
import { fullUrl, tileUrl } from './case-images';
import {
  cssRatio,
  isCut,
  openLabel,
  type PlacedScreen,
  type Screen,
  type ScreensLayout,
  tileRatio,
} from './case-screens';

/** A sheet tile is at most about half the column; a strip's or a lone figure's, two thirds. */
const TILE_SIZES = {
  single: '(max-width: 767px) calc(-2.5rem + 100vw), 40rem',
  sheet: '(max-width: 767px) calc(-2.5rem + 100vw), 32rem',
  strip: '(max-width: 767px) calc(-2.5rem + 100vw), 40rem',
} as const satisfies Record<ScreensLayout, string>;

export interface ScreensSheetProps {
  /** The section's screens (sectionScreens), each with its index among all of them. */
  readonly screens: readonly PlacedScreen[];
  /** How many screens the project has in all, the cover included: 'Open screen 2 of 4'. */
  readonly count: number;
  readonly layout: ScreensLayout;
}

interface TileProps {
  readonly screen: Screen;
  readonly index: number;
  readonly count: number;
  readonly layout: ScreensLayout;
}

/** One screen: its link (the picture) and its caption. */
function Tile({ screen, index, count, layout }: TileProps): ReactElement {
  const style = { '--r': cssRatio(tileRatio(screen.ratio)) } as CSSProperties;
  return (
    <li className={styles.tile} style={style}>
      <figure className={styles.figure}>
        <PhotoViewerLink
          index={index}
          href={fullUrl(screen)}
          aria-label={openLabel(index, count, screen.words)}
          className={styles.shot}
          data-case-screen={index + 1}
        >
          <Image
            src={tileUrl(screen)}
            alt=""
            fill
            sizes={TILE_SIZES[layout]}
            className={isCut(screen.ratio) ? styles['shot-top'] : styles['shot-image']}
          />
          <span className={styles['shot-light']} aria-hidden="true" />
        </PhotoViewerLink>
        <figcaption className={styles.caption}>
          <span className={styles.fig}>Fig. {index + 1}</span>
          {screen.words ? <span className={styles['caption-words']}>{screen.words}</span> : null}
        </figcaption>
      </figure>
    </li>
  );
}

/** The screens, in page order, as a figure, a strip or a contact sheet. */
export function ScreensSheet({ screens, count, layout }: ScreensSheetProps): ReactElement {
  return (
    <ul className={styles.sheet} data-layout={layout}>
      {screens.map(({ screen, index }) => (
        <Tile key={screen.key} screen={screen} index={index} count={count} layout={layout} />
      ))}
    </ul>
  );
}
