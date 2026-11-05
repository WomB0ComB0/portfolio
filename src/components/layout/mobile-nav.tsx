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
import { memo, useCallback, useRef, useState } from 'react';
import { FiMenu } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { MOBILE_MENU_DIALOG_ID, MobileMenuOverlay } from './mobile-menu-overlay';

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

  return (
    <>
      <nav
        className="bg-card/95 backdrop-blur-2xl border-t border-border/50 px-4 py-3.5 shadow-xl"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-center items-center max-w-md mx-auto">
          <Button
            variant="default"
            size="lg"
            className="flex items-center gap-3 py-2 px-6 rounded-full bg-linear-to-br from-primary/95 to-primary transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 font-semibold text-sm w-full justify-between"
            onClick={openMenu}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls={MOBILE_MENU_DIALOG_ID}
            ref={triggerRef}
          >
            <FiMenu size="1.2rem" strokeWidth={2.2} aria-hidden />
            <span className="leading-none text-primary-foreground">Menu</span>
          </Button>
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
