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
 * @file The shared viewer's open view, loaded lazily by photo-viewer.tsx, in the site's Radix
 * dialog: focus trapped and starting on Close (Done in the full-screen layout), Escape and a click
 * outside close it, and focus goes back to the link that opened it.
 * - The image is always whole, at its real shape (the /places no-crop rule). One taller than a
 *   phone (a full-page capture) scrolls inside its frame instead of shrinking to a sliver.
 * - The panel and its stage are sized once for the whole set (its widest and narrowest shapes,
 *   setShape), and each image sits centred on the stage, so stepping never resizes the panel and
 *   Previous and Next stay under the pointer from the first image to the last.
 * - Previous and Next go round the ends, as do the arrow keys (Home and End jump to the ends).
 *   Inside a tall capture's scroll area, Home and End scroll it as they scroll a page (as do the
 *   up and down keys); Left and Right still step.
 *   The row of thumbnails marks the one shown and keeps it in view (at once under reduced
 *   motion). The caption names it: 'Fig. 2 of 4' and its words.
 * - Opening fades the canvas in and lifts the panel 12px; a new image crossfades. The copy of the
 *   image the page already shows is drawn at once, and the whole image fades in over it when it
 *   has loaded. Opacity and transform only, so the global reduced-motion rule stills it all.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Image from 'next/image';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import styles from './photo-viewer.module.css';
import {
  COMPACT_QUERY,
  figureLabel,
  isTall,
  keyStep,
  ratioOf,
  setShape,
  stepIndex,
  stepTo,
  thumbLabel,
  type ViewerItem,
  type ViewerNoun,
} from './photo-viewer-step';

/** The frame at its widest; on a phone, the screen less its padding. */
const FULL_SIZES = '(max-width: 639px) calc(-2rem + 100vw), 64rem';
/** A tall capture's scrolling column. */
const TALL_SIZES = '(max-width: 639px) calc(-2rem + 100vw), 40rem';
/** A tall capture's scroll area, where Home and End scroll it. */
const SCROLL_AREA = '[data-viewer-scroll]';
/** The keys a tall capture's scroll area keeps; Left and Right still step (it never scrolls sideways). */
const SCROLL_KEYS: ReadonlySet<string> = new Set(['Home', 'End']);
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export interface LivePhotoViewerProps {
  readonly items: readonly ViewerItem[];
  /** The dialog's title: what the images are of. */
  readonly title: string;
  readonly noun: ViewerNoun;
  /** The image shown. */
  readonly index: number;
  /** Focus goes back here on close. */
  readonly opener: HTMLElement | null;
  readonly onIndex: (index: number) => void;
  readonly onClose: () => void;
}

/**
 * The copy of image `index` the page already shows (a link's image), when it is a same-origin
 * /_next/image URL that has loaded: drawn at once while the whole image loads over it. The CSP
 * lets images come only from the site itself, so anything else is skipped.
 */
function shownCopyOf(index: number): string | null {
  const image = document.querySelector<HTMLImageElement>(
    `[data-photo-viewer-index="${index}"] img`,
  );
  const src = image?.complete ? image.currentSrc : '';
  return src.startsWith(`${window.location.origin}/`) ? src : null;
}

/** Marks the whole image loaded, so it fades in over the copy. */
const markLoaded = (event: SyntheticEvent<HTMLImageElement>): void => {
  event.currentTarget.dataset.loaded = 'true';
};

interface FrameProps {
  readonly item: ViewerItem;
  readonly index: number;
  readonly noun: ViewerNoun;
}

/** The image, whole: fitted to its frame, or a tall capture in a column that scrolls. */
function ViewerFrame({ item, index, noun }: FrameProps): ReactElement {
  const tall = isTall(item.width, item.height);
  const alt = item.words ?? '';
  const [copy] = useState(() => (tall ? null : shownCopyOf(index)));
  return (
    <div className={styles.frame} data-tall={tall ? 'true' : undefined}>
      {tall ? (
        <section
          className={styles.scroll}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll area takes focus so a keyboard can scroll it (WCAG 2.1.1).
          tabIndex={0}
          aria-label={`The whole ${noun.one}: scroll to see all of it`}
          data-viewer-scroll=""
        >
          <Image
            src={item.src}
            alt={alt}
            width={item.width}
            height={item.height}
            sizes={TALL_SIZES}
            loading="eager"
            className={styles['tall-image']}
          />
        </section>
      ) : (
        <>
          {copy ? (
            // biome-ignore lint/performance/noImgElement: a same-origin URL the page already decoded.
            <img src={copy} alt="" className={styles.copy} />
          ) : null}
          <Image
            src={item.src}
            alt={alt}
            fill
            sizes={FULL_SIZES}
            loading="eager"
            className={styles.image}
            data-has-copy={copy ? 'true' : undefined}
            onLoad={markLoaded}
          />
        </>
      )}
    </div>
  );
}

interface StepsProps {
  readonly noun: ViewerNoun;
  readonly onStep: (delta: number) => void;
}

/** Previous and Next, round the ends. */
function ViewerSteps({ noun, onStep }: StepsProps): ReactElement {
  return (
    <div className={styles.steps}>
      <button
        type="button"
        className={styles.step}
        aria-label={`Previous ${noun.one}`}
        onClick={() => onStep(-1)}
      >
        <FiChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={styles.step}
        aria-label={`Next ${noun.one}`}
        onClick={() => onStep(1)}
      >
        <FiChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

interface StripProps {
  readonly items: readonly ViewerItem[];
  readonly index: number;
  readonly noun: ViewerNoun;
  readonly onIndex: (index: number) => void;
}

/**
 * Keeps the shown thumbnail in view as the image changes (a long row scrolls sideways): at once
 * when the viewer opens and under reduced motion, else gliding.
 */
function useShownThumbInView(listRef: RefObject<HTMLOListElement | null>, index: number): void {
  const opened = useRef(false);
  useEffect(() => {
    const thumb = listRef.current?.children.item(index)?.querySelector('button');
    const glide = opened.current && !window.matchMedia(REDUCED_MOTION).matches;
    opened.current = true;
    // jsdom has no scrollIntoView; a browser always does.
    thumb?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      behavior: glide ? 'smooth' : 'instant',
    });
  }, [listRef, index]);
}

/** Every image as a thumbnail; the one shown is marked and kept in view. */
function ViewerStrip({ items, index, noun, onIndex }: StripProps): ReactElement {
  const listRef = useRef<HTMLOListElement>(null);
  useShownThumbInView(listRef, index);
  return (
    <ol ref={listRef} className={styles.strip} aria-label={`All ${noun.many}`}>
      {items.map((item, each) => (
        <li key={item.key} className={styles['strip-item']}>
          <button
            type="button"
            className={styles.thumb}
            aria-label={thumbLabel(each, items.length, noun)}
            aria-current={each === index ? 'true' : undefined}
            onClick={() => onIndex(each)}
          >
            <Image src={item.thumb} alt="" fill sizes="120px" className={styles['thumb-image']} />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Keeps focus on a button that shows when the window crosses into or out of full screen. */
function useFocusAcrossLayouts(
  closeRef: RefObject<HTMLButtonElement | null>,
  doneRef: RefObject<HTMLButtonElement | null>,
): void {
  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const follow = ({ matches }: { readonly matches: boolean }): void => {
      const hidden = matches ? closeRef.current : doneRef.current;
      const shown = matches ? doneRef.current : closeRef.current;
      const active = document.activeElement;
      if (active === hidden || active === document.body || active === null) shown?.focus();
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [closeRef, doneRef]);
}

interface CaptionProps {
  readonly title: string;
  readonly item: ViewerItem;
  readonly index: number;
  readonly count: number;
  readonly noun: ViewerNoun;
  readonly onIndex: (index: number) => void;
}

/** The title, 'Fig. 2 of 4' and the image's words, then Previous and Next. */
function ViewerCaption({ title, item, index, count, noun, onIndex }: CaptionProps): ReactElement {
  return (
    <div className={styles.caption}>
      <div className={styles.words}>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        <DialogDescription className={styles.meta} aria-live="polite">
          <span className={styles.figure}>{figureLabel(index, count)}</span>
          {item.words ? (
            <>
              {' '}
              <span className={styles.text}>{item.words}</span>
            </>
          ) : null}
        </DialogDescription>
      </div>
      {count > 1 ? (
        <ViewerSteps noun={noun} onStep={(delta) => onIndex(stepIndex(index, delta, count))} />
      ) : null}
    </div>
  );
}

/** Whether a key is one a tall capture's scroll area keeps (Home, End) and went to it. */
const keptByScrollArea = ({ key, target }: KeyboardEvent<HTMLDivElement>): boolean =>
  SCROLL_KEYS.has(key) && target instanceof Element && target.closest(SCROLL_AREA) !== null;

/**
 * The panel's keys: the arrows step round the set and Home and End jump to its ends, except Home
 * and End in a tall capture's scroll area, where the browser keeps them to scroll it.
 */
const stepOnKey =
  (index: number, count: number, onIndex: (index: number) => void) =>
  (event: KeyboardEvent<HTMLDivElement>): void => {
    if (keptByScrollArea(event)) return;
    const step = count > 1 ? keyStep(event.key) : null;
    if (step === null) return;
    event.preventDefault();
    onIndex(stepTo(step, index, count));
  };

interface PanelSizing {
  readonly style: CSSProperties;
  readonly 'data-set-tall': '' | undefined;
  readonly 'data-set-single': '' | undefined;
}

/**
 * What the stylesheet sizes the panel from: the shown image's shape (--ratio) and the set's
 * widest and narrowest (--ratio-wide, --ratio-narrow), whether the set holds a tall capture, and
 * whether it is a set of one (no thumbnails, so the panel is centred without room for them).
 */
function panelSizing(items: readonly ViewerItem[], item: ViewerItem): PanelSizing {
  const shape = setShape(items);
  return {
    style: {
      '--ratio': String(ratioOf(item)),
      '--ratio-wide': String(shape.wide),
      '--ratio-narrow': String(shape.narrow),
    } as CSSProperties,
    'data-set-tall': shape.tall ? '' : undefined,
    'data-set-single': items.length === 1 ? '' : undefined,
  };
}

type ButtonRef = RefObject<HTMLButtonElement | null>;

interface ClosesProps {
  readonly closeRef: ButtonRef;
  readonly doneRef: ButtonRef;
}

/** Focus starts on Close, or on Done in the full-screen layout. */
const focusFirst =
  (closeRef: ButtonRef, doneRef: ButtonRef) =>
  (event: Event): void => {
    event.preventDefault();
    const compact = window.matchMedia(COMPACT_QUERY).matches;
    (compact ? doneRef : closeRef).current?.focus();
  };

/** Focus goes back to the link that opened the viewer, without scrolling the page. */
const focusOpener =
  (opener: HTMLElement | null) =>
  (event: Event): void => {
    event.preventDefault();
    opener?.focus({ preventScroll: true });
  };

/** Close (the corner) and Done (the full-screen layout's bottom bar). */
function ViewerCloses({ closeRef, doneRef }: ClosesProps): ReactElement {
  return (
    <>
      <DialogClose ref={closeRef} className={styles.close} aria-label="Close">
        <FiX aria-hidden="true" className="size-4" />
      </DialogClose>
      <DialogClose ref={doneRef} className={styles.done}>
        Done
      </DialogClose>
    </>
  );
}

/** The open view of one image of the set. */
export function LivePhotoViewer({
  items,
  title,
  noun,
  index,
  opener,
  onIndex,
  onClose,
}: LivePhotoViewerProps): ReactElement | null {
  const closeRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  useFocusAcrossLayouts(closeRef, doneRef);
  const item = items[index];
  if (!item) return null;
  const count = items.length;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPortal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <div className={styles.layer}>
          <DialogPrimitive.Content
            className={styles.panel}
            {...panelSizing(items, item)}
            data-photo-viewer=""
            onKeyDown={stepOnKey(index, count, onIndex)}
            onOpenAutoFocus={focusFirst(closeRef, doneRef)}
            onCloseAutoFocus={focusOpener(opener)}
          >
            <div className={styles.surface} />
            <div className={styles.stage}>
              <ViewerFrame key={item.key} item={item} index={index} noun={noun} />
            </div>
            <ViewerCaption {...{ title, item, index, count, noun, onIndex }} />
            {count > 1 ? (
              <ViewerStrip items={items} index={index} noun={noun} onIndex={onIndex} />
            ) : null}
            <ViewerCloses closeRef={closeRef} doneRef={doneRef} />
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
