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
 * @file The shared photo viewer's place in a page: the /places photo dialog's look and its lazy
 * pattern (#632), for any set of images, starting with a project's screens.
 *
 * - PhotoViewerRoot wraps the part of a server page that shows the images. It renders its
 *   children as they are, and the open view only once an image is opened.
 * - PhotoViewerLink is each image's link. In the server HTML it is a plain link to the whole
 *   image, so without JavaScript every image still opens. Once the page runs, a plain click opens
 *   the viewer at that image instead; a click with a modifier key (a new tab) is left alone.
 * - The open view's code (photo-viewer-live.tsx: the Radix dialog) is fetched on a first sign of
 *   intent (a pointer over or focus on a link) and at the latest on the first open. If the chunk
 *   cannot load, the link's own address opens instead, and later clicks are left to the links.
 * - Each link carries its index (data-photo-viewer-index), so the open view can draw the copy of
 *   that image the page has already shown while the whole one loads.
 */

import {
  type AnchorHTMLAttributes,
  type ComponentType,
  createContext,
  lazy,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { LivePhotoViewerProps } from './photo-viewer-live';
import { PHOTO_NOUN, type ViewerItem, type ViewerNoun } from './photo-viewer-step';

interface Opened {
  readonly index: number;
  /** Focus goes back here on close. */
  readonly opener: HTMLElement | null;
}

interface ViewerApi {
  readonly open: (index: number, opener: HTMLElement) => void;
  /** False once the open view's code failed to load: the links then work as links. */
  readonly usable: boolean;
}

const ViewerContext = createContext<ViewerApi | null>(null);

/** Fetches the open view's code; the same module every time. */
const loadViewer = () => import('./photo-viewer-live');

/** Starts fetching the open view's code, so the first open has it. Failures wait for the open. */
function preloadPhotoViewer(): void {
  loadViewer().catch(() => undefined);
}

interface Unavailable {
  /** Called once if the open view's code cannot load. */
  readonly onUnavailable: () => void;
}

type ChunkProps = LivePhotoViewerProps & Unavailable;

/** Stands in for an open view whose code failed to load: opens the image's own address. */
function ViewerUnavailable({ items, index, onUnavailable }: ChunkProps): null {
  useEffect(() => {
    onUnavailable();
    const item = items[index];
    if (item) window.location.assign(item.src);
  }, [items, index, onUnavailable]);
  return null;
}

/**
 * The open view, fetched on intent or on the first open. lazy() rethrows a rejected import during
 * render and Suspense doesn't catch errors, so a failed chunk resolves to ViewerUnavailable.
 */
const LiveViewerChunk = lazy<ComponentType<ChunkProps>>(() =>
  loadViewer().then(
    (module) => ({ default: module.LivePhotoViewer }),
    () => ({ default: ViewerUnavailable }),
  ),
);

export interface PhotoViewerRootProps {
  /** Every image the links open, in order: a link's index points into this list. */
  readonly items: readonly ViewerItem[];
  /** The viewer's title: what the images are of ('SparkMind'). */
  readonly title: string;
  /** What the images are called; photos by default. */
  readonly noun?: ViewerNoun;
  readonly children: ReactNode;
}

/** Holds the open image for the links inside it, and draws the open view once one is opened. */
export function PhotoViewerRoot({
  items,
  title,
  noun = PHOTO_NOUN,
  children,
}: PhotoViewerRootProps): ReactElement {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [usable, setUsable] = useState(true);
  const open = useCallback((index: number, opener: HTMLElement) => {
    setOpened({ index, opener });
  }, []);
  const close = useCallback(() => setOpened(null), []);
  const move = useCallback((index: number) => {
    setOpened((current) => (current ? { ...current, index } : current));
  }, []);
  const unavailable = useCallback(() => setUsable(false), []);
  const api = useMemo(() => ({ open, usable }), [open, usable]);

  return (
    <ViewerContext.Provider value={api}>
      {children}
      {opened && items.length > 0 ? (
        <Suspense fallback={null}>
          <LiveViewerChunk
            items={items}
            title={title}
            noun={noun}
            index={Math.min(opened.index, items.length - 1)}
            opener={opened.opener}
            onIndex={move}
            onClose={close}
            onUnavailable={unavailable}
          />
        </Suspense>
      ) : null}
    </ViewerContext.Provider>
  );
}

export interface PhotoViewerLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  /** The image's place in the root's items. */
  readonly index: number;
  /** The whole image: where the link goes without JavaScript. */
  readonly href: string;
  readonly children: ReactNode;
}

/** A click the viewer should take: a plain primary click, not one asking for a new tab. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/** An image's link: the whole image without JavaScript, the viewer with it. */
export function PhotoViewerLink({
  index,
  href,
  children,
  onPointerEnter,
  onFocus,
  ...rest
}: PhotoViewerLinkProps): ReactElement {
  const viewer = useContext(ViewerContext);
  return (
    <a
      {...rest}
      href={href}
      data-photo-viewer-index={index}
      onPointerEnter={(event) => {
        preloadPhotoViewer();
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        preloadPhotoViewer();
        onFocus?.(event);
      }}
      onClick={(event) => {
        if (!viewer?.usable || !isPlainClick(event)) return;
        event.preventDefault();
        viewer.open(index, event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
