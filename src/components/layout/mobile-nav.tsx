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

'use client';

import { Button } from '@/components/ui/button';
import { useKBar } from 'kbar';
import { memo, useState } from 'react';
import { FiMenu } from 'react-icons/fi';
import { MobileMenuOverlay } from './mobile-menu-overlay';

export const MobileNavBar = memo(({ path }: { path: string }) => {
  const { query } = useKBar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <nav
        className="bg-card/95 backdrop-blur-2xl border-t border-border/50 px-4 py-3.5 shadow-xl"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-center items-center max-w-md mx-auto">
          <Button
            variant="default"
            size="lg"
            className="flex items-center justify-center gap-2.5 py-3.5 px-10 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 font-semibold tracking-wide"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
          >
            <FiMenu size="1.3rem" strokeWidth={2.5} />
            <span className="text-sm">Menu</span>
          </Button>
        </div>
      </nav>
      <MobileMenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        query={query}
        pathname={path}
      />
    </>
  );
});
MobileNavBar.displayName = 'MobileNavBar';
export default MobileNavBar;
