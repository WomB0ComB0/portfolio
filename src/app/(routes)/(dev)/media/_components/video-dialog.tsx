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
 * @file The One feed's in-page player (media-play=embed), loaded only when a video is first
 * played. Adapted from Magic UI's Hero Video Dialog
 * (https://magicui.design/docs/components/hero-video-dialog, registry/magicui/hero-video-dialog.tsx):
 * its idea of a still that opens a framed player over a dimmed page. Rewritten in this site's
 * style rather than copied: the site's Radix dialog instead of a click-anywhere motion.div (a
 * focus trap, Escape, focus back to the link, a real Close button and a title), palette tokens
 * instead of white borders, gradients and backdrop blur, and one entrance (a fade and a scale
 * from 0.98 on the spring; a fade only under reduced motion) instead of eight.
 *
 * The frame is youtube-nocookie.com, which the page CSP's frame-src does not allow yet
 * (src/lib/security/csp.ts). When the browser refuses it, the player says so and links out,
 * rather than showing the browser's broken frame.
 *
 * Magic UI's licence, kept with the adapted work:
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

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Image from 'next/image';
import { type ReactElement, useLayoutEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { EMBED_FRAME_SRC } from '../_lib/media-options';

/** The canvas behind the player, dimmed by opacity (no tinted colour, no blur). */
const OVERLAY_CLASS =
  'fixed inset-0 z-50 bg-canvas opacity-90 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--motion-base) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--motion-fast) ease-effect';
/** The panel: centred by translate, which composes with the entrance's transform. */
const CONTENT_CLASS =
  'fixed top-1/2 left-1/2 z-50 flex w-[min(60rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-tile bg-surface-1 p-3 shadow-raised ring-1 ring-hairline focus:outline-none sm:p-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-[0.98] data-[state=open]:duration-(--motion-spring-in) data-[state=open]:ease-spring data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-(--motion-fast) data-[state=closed]:ease-effect';
const HEAD_CLASS = 'flex items-start justify-between gap-4 px-1';
/** The title wraps to two lines (a phone's panel is narrow) rather than being cut to one. */
const TITLE_CLASS = 'line-clamp-2 tile-title text-foreground';
const DESCRIPTION_CLASS = 'mt-0.5 tile-meta text-muted-foreground';
const CLOSE_CLASS =
  'grid size-9 flex-none place-items-center rounded-md text-muted-foreground transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground';
const FRAME_CLASS =
  "relative aspect-video w-full overflow-hidden rounded-[0.5rem] bg-surface-2 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--hairline)] after:content-['']";
const BLOCKED_CLASS =
  'absolute inset-x-3 bottom-3 flex flex-col gap-2 rounded-md bg-canvas p-3 shadow-[inset_0_0_0_1px_var(--hairline-strong)] sm:inset-x-auto sm:left-3 sm:max-w-[30rem]';
const FOOT_CLASS = 'flex flex-wrap items-center justify-between gap-2 px-1';
/** The keyboard hint: hidden where there is no Escape key (a touch screen); Close serves there. */
const HINT_CLASS = 'tile-meta text-faint [@media(pointer:coarse)]:hidden';
/** The way out keeps to the right when the hint beside it is hidden. */
const OUT_CLASS =
  'ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 tile-meta text-muted-foreground no-underline transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground';

/** The video the player shows. */
export interface PlayingVideo {
  readonly videoId: string;
  readonly title: string;
  /** Its page on YouTube, the way out. */
  readonly href: string;
}

export interface VideoDialogProps {
  readonly video: PlayingVideo;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Where focus goes back on close: the link that opened it. */
  readonly returnFocusTo: HTMLElement | null;
}

/** The privacy-enhanced embed: no cookies until the visitor plays, autoplay, no unrelated videos. */
const embedUrl = (videoId: string): string =>
  `${EMBED_FRAME_SRC}/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;

/** What playback needs of the browser, and nothing more (no sensors, clipboard or share sheet). */
const FRAME_ALLOW = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
/**
 * The frame's sandbox: the player's scripts on its own origin (it plays nothing without them),
 * casting, and YouTube's own links in a new tab that is not sandboxed itself. Never
 * allow-top-navigation: the frame cannot send this page anywhere.
 */
const FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

/** YouTube's 1280px still, sharp in the frame; not every video has one. */
const LARGE_STILL = 'maxresdefault';
/** YouTube's 480px still, which every video has: the fallback. */
const SMALL_STILL = 'hqdefault';
const DESCRIPTION = 'Plays here from YouTube, privacy-enhanced.';
const BLOCKED_DESCRIPTION = "From YouTube. This site's settings block the player.";

const posterUrl = (videoId: string, still: string): string =>
  `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/${still}.jpg`;

/**
 * The still under the frame while it loads (or when it is blocked): the large one, or the small
 * one when YouTube has no large still for the video. Keyed by its video, so each starts large.
 */
function Poster({ videoId }: { readonly videoId: string }): ReactElement {
  const [still, setStill] = useState(LARGE_STILL);
  return (
    <Image
      src={posterUrl(videoId, still)}
      alt=""
      fill
      sizes="(min-width: 64rem) 60rem, 100vw"
      className="object-cover"
      onError={() => setStill(SMALL_STILL)}
    />
  );
}

/** Only the fixed player origin (or an unnamed frame refusal) can block this player. */
function isPlayerFrameUri(uri: string): boolean {
  if (uri === '') return true;
  try {
    return new URL(uri).origin === EMBED_FRAME_SRC;
  } catch {
    return false;
  }
}

/**
 * Whether the page CSP refused the player's frame while open. The violation is queued as a task,
 * so a listener added in a layout effect (before the frame starts loading) always hears it.
 */
function useFrameBlocked(open: boolean, videoId: string): boolean {
  const [blocked, setBlocked] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new video starts unblocked and listens anew.
  useLayoutEffect(() => {
    setBlocked(false);
    if (!open) return undefined;
    /** A frame-src (or child-src) refusal of the embed's origin, or of an unnamed frame. */
    const onViolation = (event: SecurityPolicyViolationEvent): void => {
      const directive = event.effectiveDirective || event.violatedDirective || '';
      const isFrame = directive.startsWith('frame-src') || directive.startsWith('child-src');
      const uri = event.blockedURI ?? '';
      if (isFrame && isPlayerFrameUri(uri)) setBlocked(true);
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    return () => document.removeEventListener('securitypolicyviolation', onViolation);
  }, [open, videoId]);
  return blocked;
}

const BLOCKED_LINK_TEXT = 'watch it on YouTube';

/** What the visitor sees instead of a broken frame: its unavailable state and the way out. */
function BlockedNote({ href }: { readonly href: string }): ReactElement {
  return (
    <div role="status" data-player-blocked="" className={BLOCKED_CLASS}>
      <p className="tile-sub text-foreground">This video can't play here yet.</p>
      <p className="tile-meta text-muted-foreground">
        You can still{' '}
        {/* The new-tab words ride in the name: SrOnlyWords' space would show before the full stop. */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${BLOCKED_LINK_TEXT} ${NEW_TAB_LABEL}`}
          className="text-brand-ink"
        >
          {BLOCKED_LINK_TEXT}
        </a>
        .
      </p>
    </div>
  );
}

/** The player: the video's title, Close, the frame (or why it is blocked) and the way out. */
export function VideoDialog({
  video,
  open,
  onOpenChange,
  returnFocusTo,
}: VideoDialogProps): ReactElement {
  const blocked = useFrameBlocked(open, video.videoId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASS} />
        <DialogPrimitive.Content
          data-video-dialog=""
          className={CONTENT_CLASS}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
        >
          <div className={HEAD_CLASS}>
            <div className="min-w-0">
              <DialogTitle className={TITLE_CLASS}>{video.title}</DialogTitle>
              <DialogDescription className={DESCRIPTION_CLASS}>
                {blocked ? BLOCKED_DESCRIPTION : DESCRIPTION}
              </DialogDescription>
            </div>
            <DialogClose className={CLOSE_CLASS}>
              <FiX aria-hidden="true" className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div className={FRAME_CLASS}>
            <Poster key={`poster:${video.videoId}`} videoId={video.videoId} />
            {blocked ? (
              <BlockedNote href={video.href} />
            ) : (
              <iframe
                key={video.videoId}
                src={embedUrl(video.videoId)}
                title={`${video.title}, on YouTube`}
                allow={FRAME_ALLOW}
                sandbox={FRAME_SANDBOX}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full"
              />
            )}
          </div>
          <div className={FOOT_CLASS}>
            <span className={HINT_CLASS}>Esc closes</span>
            <a href={video.href} target="_blank" rel="noopener noreferrer" className={OUT_CLASS}>
              Watch on YouTube
              <NewTabArrow />
              <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
            </a>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export default VideoDialog;
