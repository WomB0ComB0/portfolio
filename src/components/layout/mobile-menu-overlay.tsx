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
import { FiCommand, FiHome, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
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

/** Seconds between each section's entrance. */
const SECTION_STAGGER_S = 0.05;

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

const MobileNavLink = ({ item, isCurrent, onNavigate }: MobileNavLinkProps) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      'w-full h-auto min-h-11 flex items-center justify-start gap-3 text-sm py-3 px-4 rounded-md',
      isCurrent
        ? 'bg-primary/10 font-medium text-foreground'
        : 'hover:bg-accent/40 text-foreground',
    )}
    onClick={onNavigate}
  >
    <Link href={item.slug} aria-current={isCurrent ? 'page' : undefined}>
      <item.icon size="1rem" aria-hidden />
      <span>{item.name}</span>
    </Link>
  </Button>
);

export interface MobileNavSectionProps {
  readonly group: NavGroupData;
  readonly pathname: string;
  readonly onNavigate: () => void;
  /** Position among the sections, which staggers their entrance. */
  readonly order: number;
}

/** One nav group in the mobile menu: its heading and every page in it, always listed. */
export const MobileNavSection = ({ group, pathname, onNavigate, order }: MobileNavSectionProps) => {
  const headingId = `mobile-nav-${group.id}`;
  const Icon = group.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (order + 1) * SECTION_STAGGER_S }}
      className="pt-3"
    >
      <h3
        id={headingId}
        className="flex items-center gap-2 px-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Icon size="0.875rem" aria-hidden />
        {group.label}
      </h3>
      <ul aria-labelledby={headingId} className="grid gap-1 sm:grid-cols-2">
        {group.items.map((item) => (
          <li key={item.slug}>
            <MobileNavLink item={item} isCurrent={pathname === item.slug} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

interface MobileHomeLinkProps {
  readonly item: NavItem;
  readonly pathname: string;
  readonly onNavigate: () => void;
}

const MobileHomeLink = ({ item, pathname, onNavigate }: MobileHomeLinkProps) => {
  const isCurrent = pathname === item.slug;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: SECTION_STAGGER_S }}
    >
      <Button
        asChild
        variant="ghost"
        className={cn(
          'w-full flex items-center justify-start gap-3 text-base py-3 px-4 rounded-lg transition-all',
          isCurrent
            ? // Override the ghost variant's hover:bg-accent, which would put the dark
              // primary-foreground label on the accent surface (about 2:1).
              'bg-primary/95 text-primary-foreground hover:bg-primary/95 hover:text-primary-foreground'
            : 'hover:bg-accent',
        )}
        onClick={onNavigate}
      >
        <Link
          href={item.slug}
          className="flex items-center gap-3 w-full"
          aria-current={isCurrent ? 'page' : undefined}
        >
          <div
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-md',
              isCurrent ? 'bg-primary-foreground/20' : 'bg-primary/8',
            )}
          >
            <FiHome size="1.05rem" aria-hidden />
          </div>
          <span
            className={cn('font-medium', isCurrent ? 'text-primary-foreground' : 'text-foreground')}
          >
            {item.name}
          </span>
        </Link>
      </Button>
    </motion.div>
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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-9998 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, type: 'spring' as const, damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-9999 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={MOBILE_MENU_TITLE_ID}
          id={MOBILE_MENU_DIALOG_ID}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-linear-to-b from-card/80 to-card/60 backdrop-blur-md">
            <h2 id={MOBILE_MENU_TITLE_ID} className="font-semibold text-lg text-foreground">
              {MOBILE_MENU_TITLE}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full h-9 w-9"
              onClick={onClose}
              aria-label="Close menu"
            >
              <FiX size="1.25rem" aria-hidden />
            </Button>
          </div>

          <nav className="p-4 pb-8 space-y-1.5" aria-label="Site pages">
            {HOME_NAV_ITEM && (
              <MobileHomeLink item={HOME_NAV_ITEM} pathname={pathname} onNavigate={onClose} />
            )}

            {NAV_GROUPS.map((group, index) => (
              <MobileNavSection
                key={group.id}
                group={group}
                pathname={pathname}
                onNavigate={onClose}
                order={index + 1}
              />
            ))}

            <div className="py-2">
              <div className="border-t border-border/60" />
            </div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (NAV_GROUPS.length + 2) * SECTION_STAGGER_S }}
            >
              <Button
                variant="ghost"
                className="w-full flex items-center justify-start gap-3 text-base py-3 px-4 rounded-lg hover:bg-accent transition-all"
                onClick={() => {
                  query.toggle();
                  onClose();
                }}
                aria-label="Open command menu"
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-md bg-primary/8">
                  <FiCommand size="1.05rem" className="text-foreground" aria-hidden />
                </div>
                <span className="font-medium text-foreground">Command Menu</span>
              </Button>
            </motion.div>
          </nav>
        </motion.div>
      </AnimatePresence>
    );

    return createPortal(content, document.body);
  },
);
MobileMenuOverlay.displayName = 'MobileMenuOverlay';
export default MobileMenuOverlay;
