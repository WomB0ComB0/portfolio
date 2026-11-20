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

import { useKBar } from 'kbar';
import { Menu, Search } from 'lucide-react';
import { memo, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { PALETTE_SEARCH_LABEL, usePaletteShortcut, withShortcut } from '@/components/cmd';
import { cn } from '@/lib/utils';
import { MOBILE_MENU_DIALOG_ID, MobileMenuOverlay } from './mobile-menu-overlay';

/** Both bar buttons: 44 px tall pills on surface-2 with a hairline. */
const BAR_BUTTON =
  'inline-flex h-11 items-center rounded-full border border-hairline bg-surface-2 text-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:bg-surface-3';

/**
 * Where the Search button's shortcut hint hides: Tailwind's pointer-coarse variant (its
 * pointer-coarse:hidden class), a touch screen as the main pointer.
 */
const COARSE_POINTER = '(pointer: coarse)';

const subscribeToPointer = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const browserHintHidden = (): boolean => window.matchMedia(COARSE_POINTER).matches;
/** Server HTML and hydration show the hint, so the name says it there too. */
const serverHintHidden = (): boolean => false;

/**
 * Whether the shortcut hint is hidden on this device. False on the server and while hydrating,
 * true right after on a touch screen, and it follows the media query as it changes.
 */
const useHintHidden = (): boolean =>
  useSyncExternalStore(subscribeToPointer, browserHintHidden, serverHintHidden);

/**
 * Opens the command palette, which makes it the quickest way to any page on a phone as well.
 * Its ⌘K / Ctrl K hint shows only when the main pointer is not a touch screen (a narrow desktop
 * window, say); on a touch screen the button is a 44 px circle. Where the hint shows it is the
 * only text the button shows, so its name ends with it ('Search pages and commands, Ctrl K',
 * WCAG 2.5.3); where it hides, the name leaves it out. aria-keyshortcuts gives the keys either way.
 */
const PaletteSearchButton = ({ onOpen }: { readonly onOpen: () => void }) => {
  const shortcut = usePaletteShortcut();
  const isHintHidden = useHintHidden();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        isHintHidden ? PALETTE_SEARCH_LABEL : withShortcut(PALETTE_SEARCH_LABEL, shortcut)
      }
      aria-keyshortcuts={shortcut.keys}
      className={cn(BAR_BUTTON, 'min-w-11 shrink-0 justify-center gap-2 px-3')}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <kbd className="font-mono text-meta text-muted-foreground pointer-coarse:hidden">
        {shortcut.label}
      </kbd>
    </button>
  );
};

export const MobileNavBar = memo(({ path }: { path: string }) => {
  const { query } = useKBar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // The shell stays mounted across navigations, so a route change the menu didn't make itself
  // (Back, Forward, the palette) must close it here, or it stays open over the new page.
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) {
    setMenuPath(path);
    setIsMenuOpen(false);
  }
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const openPalette = useCallback(() => query.toggle(), [query]);

  // The bar is --mobile-bar-total tall (globals.css), the same value the page column clears in
  // layout.tsx. Border-box padding of the safe-area inset keeps the controls in the --mobile-bar-h
  // band above the home indicator.
  return (
    <>
      <nav
        className="flex h-(--mobile-bar-total) items-center border-t border-hairline bg-canvas/85 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <button
            ref={triggerRef}
            type="button"
            onClick={openMenu}
            className={cn(BAR_BUTTON, 'flex-1 justify-between px-5 text-body-sm font-medium')}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            // The dialog renders only while open, so it is named only then: an id that is not in
            // the page is a broken reference.
            aria-controls={isMenuOpen ? MOBILE_MENU_DIALOG_ID : undefined}
          >
            <Menu className="size-4.5 shrink-0" aria-hidden />
            <span>Menu</span>
          </button>
          <PaletteSearchButton onOpen={openPalette} />
        </div>
      </nav>
      <MobileMenuOverlay
        isOpen={isMenuOpen}
        onClose={closeMenu}
        query={query}
        pathname={path}
        triggerRef={triggerRef}
      />
    </>
  );
});
MobileNavBar.displayName = 'MobileNavBar';
