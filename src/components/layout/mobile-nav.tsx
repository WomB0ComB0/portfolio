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
import { memo, useCallback, useRef, useState } from 'react';
import { PALETTE_SEARCH_LABEL, usePaletteShortcut } from '@/components/cmd';
import { cn } from '@/lib/utils';
import { MOBILE_MENU_DIALOG_ID, MobileMenuOverlay } from './mobile-menu-overlay';

/** Both bar buttons: 44 px tall pills on surface-2 with a hairline. */
const BAR_BUTTON =
  'inline-flex h-11 items-center rounded-full border border-hairline bg-surface-2 text-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:bg-surface-3';

/**
 * Opens the command palette, which makes it the quickest way to any page on a phone as well.
 * Its ⌘K / Ctrl K hint shows only with a fine pointer (a narrow window or a tablet with a
 * keyboard); on a touch screen the button is a 44 px circle. The aria-label is the whole name,
 * so the hint stays out of it; aria-keyshortcuts carries the shortcut instead.
 */
const PaletteSearchButton = ({ onOpen }: { readonly onOpen: () => void }) => {
  const shortcut = usePaletteShortcut();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={PALETTE_SEARCH_LABEL}
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
            aria-controls={MOBILE_MENU_DIALOG_ID}
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
export default MobileNavBar;
