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

import { StatusBadge } from '@/components/custom/StatusBadge';
import Link from 'next/link';
import { memo } from 'react';

export const Footer = memo(() => {
  const linkClasses =
    'text-primary hover:text-primary/90 dark:hover:text-primary/90 underline decoration-dotted underline-offset-4 transition duration-300';

  return (
    <footer className="w-full py-4 px-4 md:px-8 mt-auto">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 w-full justify-between items-center mx-auto">
        <p className="m-0 text-sm text-center sm:text-left pl-10 text-muted-foreground">
          <a
            className={linkClasses}
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noreferrer"
          >
            MIT
          </a>{' '}
          2024-present &#169;{' '}
          <a
            className={linkClasses}
            href="https://github.com/WomB0ComB0"
            target="_blank"
            rel="noreferrer"
          >
            Mike Odnis
          </a>
        </p>

        <div className="flex items-center gap-3 sm:gap-4">
          <nav className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            <Link className={linkClasses} href="/licenses">
              Licenses
            </Link>
            <span className="hidden sm:inline mx-1">•</span>
            <Link className={linkClasses} href="/privacy">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline mx-1">•</span>
            <Link className={linkClasses} href="/cookies">
              Cookie Policy
            </Link>
          </nav>

          <span className="hidden sm:inline mx-1">•</span>
          <StatusBadge />
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';
export default Footer;
