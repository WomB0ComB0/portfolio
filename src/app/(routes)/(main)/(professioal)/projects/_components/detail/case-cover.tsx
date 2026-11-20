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
 * @file The hero's cover, server-rendered, on the QuietStage light (no blurred copy of it):
 * - a web page's shape on a project with a live site sits in a slim browser frame whose bar shows
 *   that site's real address; any other cover sits as a print at its own shape, held to a height
 *   so a square logo or a portrait never takes over;
 * - the next screen peeks out from behind its top corner, the /places photo folder at hero size,
 *   or stands in front of its lower corner when it is a phone screenshot;
 * - '4 screens · open one' under it. Each is a link to the whole image that opens the viewer.
 * A project with no image at all gets its description set large as the plate instead (Folio's
 * typographic cover), so the stage is never an empty box.
 */

import { Lock } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import { Byline } from '@/components/console/folio';
import { PhotoViewerLink } from '@/components/console/photo/photo-viewer';
import Image from '@/components/ui/cdn-image';
import { Prose } from './breakable';
import styles from './case-hero.module.css';
import { fullUrl, heroUrl } from './case-images';
import {
  type CoverFrame,
  coverFrame,
  coverLabel,
  cssRatio,
  openLabel,
  type PeekStyle,
  peekStyle,
  type Screen,
  screensCount,
  tileRatio,
} from './case-screens';

/** The front frame: the hero's media column is about 40rem wide at most, the page below 56rem. */
const FRONT_SIZES = '(max-width: 895px) calc(-2.5rem + 100vw), 40rem';
/** The second screen: two thirds of the column, or a phone's width. */
const BACK_SIZES = '(max-width: 895px) 64vw, 26rem';
/** A peek from behind is cut to at least this wide a shape, so it never hangs below the cover. */
const BEHIND_MIN_RATIO = 1.3;

export interface CaseCoverProps {
  readonly screens: readonly Screen[];
  /** The live site's address, shown in a browser frame's bar; null without a live site. */
  readonly host: string | null;
}

interface FrontProps {
  readonly screen: Screen;
  readonly frame: CoverFrame;
  readonly host: string | null;
  readonly count: number;
}

/**
 * The cover: a browser frame with the live address, or a print at its own shape. The address is
 * the link's only text, so the link's name starts with it as shown (coverLabel, WCAG 2.5.3); the
 * bar itself stays out of the accessibility tree, where the name already says it.
 */
function Front({ screen, frame, host, count }: FrontProps): ReactElement {
  const shownHost = frame === 'browser' ? host : null;
  return (
    <PhotoViewerLink
      index={0}
      href={fullUrl(screen)}
      aria-label={coverLabel(count, screen.words, shownHost)}
      className={styles.front}
      data-frame={frame}
      data-case-cover=""
    >
      {shownHost ? (
        <span className={styles.bar} aria-hidden="true">
          <Lock className={styles['bar-icon']} />
          <span className={`mono-token ${styles['bar-host']}`}>{shownHost}</span>
        </span>
      ) : null}
      <span className={styles.shot}>
        <Image
          src={heroUrl(screen)}
          alt=""
          fill
          priority
          sizes={FRONT_SIZES}
          className={frame === 'print' ? styles['image-whole'] : styles['image-top']}
        />
      </span>
      <span className={styles.light} aria-hidden="true" />
    </PhotoViewerLink>
  );
}

interface BackProps {
  readonly screen: Screen;
  readonly peek: PeekStyle;
  readonly count: number;
}

/** The next screen: peeking from behind the cover, or a phone standing in front of its corner. */
function Back({ screen, peek, count }: BackProps): ReactElement {
  return (
    <PhotoViewerLink
      index={1}
      href={fullUrl(screen)}
      aria-label={openLabel(1, count, screen.words)}
      className={styles.back}
      data-case-peek={peek}
    >
      <span className={styles['back-shot']}>
        <Image
          src={heroUrl(screen)}
          alt=""
          fill
          sizes={BACK_SIZES}
          className={styles['image-top']}
        />
      </span>
      <span className={styles.light} aria-hidden="true" />
    </PhotoViewerLink>
  );
}

/** The shape the second screen is drawn at: a phone's own, or cut to a wide peek. */
const backRatio = (back: Screen): number =>
  peekStyle(back) === 'phone'
    ? tileRatio(back.ratio)
    : Math.max(BEHIND_MIN_RATIO, tileRatio(back.ratio));

/** The ratios the frames are drawn at, as CSS custom properties. */
function stackStyle(front: Screen, frame: CoverFrame, back: Screen | undefined): CSSProperties {
  const frontRatio = frame === 'browser' ? front.ratio : tileRatio(front.ratio);
  return {
    '--front-ratio': cssRatio(frontRatio),
    ...(back ? { '--back-ratio': cssRatio(backRatio(back)) } : {}),
  } as CSSProperties;
}

/** The cover and the next screen under it; nothing without an image. */
export function CaseCover({ screens, host }: CaseCoverProps): ReactElement | null {
  const [front, back] = screens;
  if (!front) return null;
  const frame = coverFrame(front, host !== null);
  const peek = back ? peekStyle(back) : undefined;
  return (
    <div className={styles.cover}>
      <div className={styles.stack} data-peek={peek} style={stackStyle(front, frame, back)}>
        <Front screen={front} frame={frame} host={host} count={screens.length} />
        {back && peek ? <Back screen={back} peek={peek} count={screens.length} /> : null}
      </div>
      {screens.length > 1 ? (
        <Byline parts={[screensCount(screens.length), 'open one']} className={styles.note} />
      ) : null}
    </div>
  );
}

/** A project with no image: its description, set large on the stage, as the cover. */
export function CasePlate({ text }: { readonly text: string }): ReactElement {
  return (
    <div className={styles.plate} data-case-plate="">
      <p className={styles.standfirst}>
        <Prose text={text} />
      </p>
    </div>
  );
}
