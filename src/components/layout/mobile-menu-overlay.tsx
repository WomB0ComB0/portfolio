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

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import type React from 'react';
import { memo, type RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCommand, FiX } from 'react-icons/fi';
import { DURATION_MS, EASE, seconds } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import type { MobileMenuOverlayProps } from './mobile-menu-overlay.types';
import { HOME_NAV_ITEM, NAV_GROUPS, type NavGroupData, type NavItem } from './nav';

/**
 * Tailwind's `lg` breakpoint, where layout.tsx swaps the bottom bar for the sidebar. It is in rem,
 * so it follows the browser's font size (1024 px only at the default 16 px); matching the same
 * query closes the overlay exactly when the bar that opened it is gone.
 */
const SIDEBAR_MEDIA_QUERY = '(min-width: 64rem)';

/** The dialog's id, which the Menu button names in aria-controls. */
export const MOBILE_MENU_DIALOG_ID = 'mobile-menu-dialog';

/** The dialog's accessible name, shown as its heading. */
export const MOBILE_MENU_TITLE = 'Site menu';

const MOBILE_MENU_TITLE_ID = 'mobile-menu-title';

/** Menu icons, in rem so they follow the browser's font size. */
const ITEM_ICON_SIZE = '1rem';
const SECTION_ICON_SIZE = '0.875rem';
const CLOSE_ICON_SIZE = '1.125rem';

/** Every row in the menu, links and the command menu button alike: at least a 44 px target. */
const MENU_ITEM =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-body-sm transition-colors duration-(--motion-fast) ease-standard';
const MENU_ITEM_IDLE = 'text-foreground hover:bg-surface-3';
const MENU_ITEM_CURRENT = 'bg-brand-subtle font-medium text-brand-ink';

/** The sheet rises this far as it fades in, in px. */
const SHEET_OFFSET_PX = 24;
const BACKDROP_TRANSITION = { duration: seconds(DURATION_MS.fast), ease: EASE.outExpo } as const;
const SHEET_TRANSITION = { duration: seconds(DURATION_MS.base), ease: EASE.outExpo } as const;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const focusablesIn = (root: HTMLElement | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

/** Keeps Tab and Shift+Tab cycling inside the dialog, pulling focus back if it got out. */
const trapTab = (event: KeyboardEvent, dialog: HTMLElement | null): void => {
  const nodes = focusablesIn(dialog);
  const first = nodes.at(0);
  const last = nodes.at(-1);
  if (!first || !last) return;

  const active = document.activeElement;
  const isInside = active instanceof Node && dialog?.contains(active) === true;
  if (event.shiftKey && (active === first || !isInside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !isInside)) {
    event.preventDefault();
    first.focus();
  }
};

/** Stops the page behind the open menu from scrolling. */
const useBodyScrollLock = (isOpen: boolean): void => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
};

/**
 * Moves focus into the dialog once it opens, and back to the button that opened it once it
 * closes, however it closes (Close, Escape, a link, the backdrop or the resize below).
 */
const useDialogFocus = (
  isOpen: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLButtonElement | null> | undefined,
): void => {
  useEffect(() => {
    if (!isOpen) return;
    // The portal mounts after this commit, so the first focusable exists only on the next task.
    const timer = setTimeout(() => focusablesIn(dialogRef.current).at(0)?.focus(), 0);
    return () => {
      clearTimeout(timer);
      triggerRef?.current?.focus();
    };
  }, [isOpen, dialogRef, triggerRef]);
};

/** Escape closes the dialog; Tab stays inside it. */
const useDialogKeyboard = (
  isOpen: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        trapTab(event, dialogRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, dialogRef, onClose]);
};

/** Closes the overlay once the window is wide enough for the sidebar to replace the bottom bar. */
const useCloseAtSidebarWidth = (isOpen: boolean, onClose: () => void): void => {
  useEffect(() => {
    if (!isOpen) return;

    const sidebarQuery = window.matchMedia(SIDEBAR_MEDIA_QUERY);
    const closeOnceSidebarShows = () => {
      if (sidebarQuery.matches) onClose();
    };

    sidebarQuery.addEventListener('change', closeOnceSidebarShows);
    return () => sidebarQuery.removeEventListener('change', closeOnceSidebarShows);
  }, [isOpen, onClose]);
};

interface MobileNavLinkProps {
  readonly item: NavItem;
  readonly isCurrent: boolean;
  readonly onNavigate: () => void;
}

/** A page row: the current page is a brand-subtle fill with brand-ink text. */
const MobileNavLink = ({ item, isCurrent, onNavigate }: MobileNavLinkProps) => (
  <Link
    href={item.slug}
    onClick={onNavigate}
    aria-current={isCurrent ? 'page' : undefined}
    className={cn(MENU_ITEM, isCurrent ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE)}
  >
    <item.icon size={ITEM_ICON_SIZE} className="shrink-0" aria-hidden />
    <span>{item.name}</span>
  </Link>
);

export interface MobileNavSectionProps {
  readonly group: NavGroupData;
  readonly pathname: string;
  readonly onNavigate: () => void;
}

/** One nav group in the mobile menu: its heading and every page in it, always listed. */
export const MobileNavSection = ({ group, pathname, onNavigate }: MobileNavSectionProps) => {
  const headingId = `mobile-nav-${group.id}`;
  const Icon = group.icon;
  return (
    <div className="pt-4">
      <h3 id={headingId} className="label-mono flex items-center gap-2 px-3 pb-1.5 text-faint">
        <Icon size={SECTION_ICON_SIZE} aria-hidden />
        {group.label}
      </h3>
      <ul aria-labelledby={headingId} className="grid gap-1 sm:grid-cols-2">
        {group.items.map((item) => (
          <li key={item.slug}>
            <MobileNavLink item={item} isCurrent={pathname === item.slug} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = memo(
  ({ isOpen, onClose, pathname, query, triggerRef }) => {
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    useBodyScrollLock(isOpen);
    useDialogFocus(isOpen, dialogRef, triggerRef);
    useDialogKeyboard(isOpen, dialogRef, onClose);
    useCloseAtSidebarWidth(isOpen, onClose);

    if (!mounted || !isOpen) return null;

    const content = (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={BACKDROP_TRANSITION}
          className="fixed inset-0 z-9998 bg-canvas/70 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: SHEET_OFFSET_PX }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: SHEET_OFFSET_PX }}
          transition={SHEET_TRANSITION}
          className="fixed inset-x-0 bottom-0 z-9999 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-tile border-t border-hairline bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-raised"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={MOBILE_MENU_TITLE_ID}
          id={MOBILE_MENU_DIALOG_ID}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface-1/90 py-3 pr-3 pl-6 backdrop-blur-md">
            <h2 id={MOBILE_MENU_TITLE_ID} className="text-body font-semibold text-foreground">
              {MOBILE_MENU_TITLE}
            </h2>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-3 hover:text-foreground"
              onClick={onClose}
              aria-label="Close menu"
            >
              <FiX size={CLOSE_ICON_SIZE} aria-hidden />
            </button>
          </div>

          <nav className="px-3 pt-3 pb-6" aria-label="Site pages">
            {HOME_NAV_ITEM && (
              <MobileNavLink
                item={HOME_NAV_ITEM}
                isCurrent={pathname === HOME_NAV_ITEM.slug}
                onNavigate={onClose}
              />
            )}

            {NAV_GROUPS.map((group) => (
              <MobileNavSection
                key={group.id}
                group={group}
                pathname={pathname}
                onNavigate={onClose}
              />
            ))}

            <div className="mt-4 border-t border-hairline pt-3">
              <button
                type="button"
                className={cn(MENU_ITEM, MENU_ITEM_IDLE)}
                onClick={() => {
                  query.toggle();
                  onClose();
                }}
                aria-label="Open command menu"
              >
                <FiCommand size={ITEM_ICON_SIZE} className="shrink-0" aria-hidden />
                <span>Command menu</span>
              </button>
            </div>
          </nav>
        </motion.div>
      </AnimatePresence>
    );

    return createPortal(content, document.body);
  },
);
MobileMenuOverlay.displayName = 'MobileMenuOverlay';
export default MobileMenuOverlay;
