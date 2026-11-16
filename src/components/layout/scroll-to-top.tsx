'use client';

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

import { type CSSProperties, type ReactElement, useEffect, useState } from 'react';
import { FiArrowUp } from 'react-icons/fi';
import { MAIN_CONTENT_ID } from '@/components/animations/pages/page-transition';
import { isPopoverOpen } from '@/components/console/filter-bar/outside-press';
import { Button } from '@/components/ui/button';
import { prefersReducedMotion } from '@/lib/design/motion';

/** Mirror the page column, keeping the control clear of the phone bar and its safe area. */
const POSITION_CLASS =
  'pointer-events-none fixed inset-x-0 bottom-[max(calc(var(--mobile-bar-total)+0.75rem),var(--scroll-top-footer-bottom))] z-40 lg:bottom-[max(1rem,env(safe-area-inset-bottom),var(--scroll-top-footer-bottom))] lg:pl-16';
const COLUMN_CLASS = 'mx-auto flex w-full max-w-shell justify-end px-(--page-gutter)';
const BUTTON_CLASS =
  'pointer-events-auto size-11 rounded-full bg-surface-2 text-muted-foreground shadow-raised';
/** A 12px gap above the footer; cap the lift so the 2.75rem control stays on a short screen. */
const FOOTER_BOTTOM =
  'min(calc(var(--scroll-top-footer-clearance) + 0.75rem), calc(100dvh - 3.75rem - env(safe-area-inset-top)))';

const LAYERS =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [popover]';

/** The palette/mobile menu lock body scrolling; dialogs and native sheets also mark their layer. */
function pageCovered(): boolean {
  const body = document.body;
  if (
    body.style.overflow === 'hidden' ||
    body.style.overflowY === 'hidden' ||
    body.hasAttribute('data-scroll-locked')
  )
    return true;
  return Array.from(document.querySelectorAll<HTMLElement>(LAYERS)).some((layer) => {
    if (layer.hasAttribute('popover')) return isPopoverOpen(layer);
    if (layer.tagName === 'DIALOG' && !layer.hasAttribute('open')) return false;
    if (
      layer.getAttribute('data-state') === 'closed' ||
      layer.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      return false;
    const style = getComputedStyle(layer);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/** Useful on tall displays even when a page has less than one viewport of total travel. */
const MAX_REVEAL_SCROLL_PX = 320;

interface Visibility {
  readonly path: string;
  readonly shown: boolean;
  readonly footerClearance: number;
}

/** Only the shared footer beside main, never a footer nested inside an article. */
function footerClearance(height: number): number {
  const footer = document
    .getElementById(MAIN_CONTENT_ID)
    ?.parentElement?.querySelector<HTMLElement>(':scope > footer');
  const box = footer?.getBoundingClientRect();
  return box && box.bottom > 0 ? Math.max(0, height - box.top) : 0;
}

/** Scroll/resize work is batched once per frame; route changes invalidate the previous page immediately. */
function useVisibility(path: string): Visibility {
  const [visible, setVisible] = useState<Visibility>({ path, shown: false, footerClearance: 0 });
  useEffect(() => {
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const height = window.innerHeight;
      const threshold = Math.min(MAX_REVEAL_SCROLL_PX, height / 2);
      const shown =
        height > 0 &&
        window.scrollY >= threshold &&
        document.documentElement.scrollHeight > height &&
        !pageCovered();
      const clearance = shown ? footerClearance(height) : 0;
      setVisible((previous) =>
        previous.path === path && previous.shown === shown && previous.footerClearance === clearance
          ? previous
          : { path, shown, footerClearance: clearance },
      );
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resize?.observe(document.body);
    // Layer state changes are infrequent. Body lock styles are watched separately so animation
    // styles throughout the page do not cause a document-wide visibility read every frame.
    const layers = new MutationObserver(schedule);
    layers.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'role',
        'open',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-modal',
        'data-state',
      ],
    });
    const locks = new MutationObserver(schedule);
    locks.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'data-scroll-locked'],
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    document.addEventListener('toggle', schedule, true);
    document.addEventListener('focusin', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      layers.disconnect();
      locks.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('popstate', schedule);
      window.removeEventListener('hashchange', schedule);
      document.removeEventListener('toggle', schedule, true);
      document.removeEventListener('focusin', schedule, true);
    };
  }, [path]);
  return visible.path === path ? visible : { path, shown: false, footerClearance: 0 };
}

/** Preserve Next's history state and filters; a stale section fragment must not undo this on reload. */
function returnToTop(): void {
  if (pageCovered()) return;
  const main = document.getElementById(MAIN_CONTENT_ID);
  if (!main) return;
  // focusInPlace permits scrolling for an offscreen target; here the scroll below owns motion.
  main.focus({ preventScroll: true });
  const { pathname, search, hash } = window.location;
  if (hash) window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
}

/** One shared shell control. Absent in server HTML and from the tab order while not useful. */
export function ScrollToTop({ path }: { readonly path: string }): ReactElement | null {
  const { shown, footerClearance: clearance } = useVisibility(path);
  if (!shown) return null;
  return (
    <div
      className={POSITION_CLASS}
      data-scroll-top-position=""
      style={
        {
          '--scroll-top-footer-clearance': `${clearance}px`,
          '--scroll-top-footer-bottom': FOOTER_BOTTOM,
        } as CSSProperties
      }
    >
      <div className={COLUMN_CLASS}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={BUTTON_CLASS}
          aria-label="Back to top"
          title="Back to top"
          data-scroll-top=""
          onClick={returnToTop}
        >
          <FiArrowUp aria-hidden="true" focusable="false" />
        </Button>
      </div>
    </div>
  );
}
