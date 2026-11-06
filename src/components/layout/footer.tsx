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

import Link from 'next/link';
import { memo } from 'react';
import { StatusBadge } from '@/components/custom/status-badge';

/** The SPDX id in package.json and LICENSE; /licenses explains what it covers. */
const SITE_LICENSE = 'Apache-2.0';

/**
 * As wide as the page column and centred under it, with the page gutter inside. The shell's
 * column already clears the desktop rail, so the footer needs no offset of its own.
 */
const FOOTER_CLASS =
  'mx-auto mt-auto w-full max-w-shell border-t border-hairline px-(--page-gutter) py-6';

/** One mono line on wide screens; stacked and centred on phones. */
const ROW_CLASS =
  'flex flex-col items-center gap-3 font-mono text-meta text-muted-foreground sm:flex-row sm:justify-between';

/** The base `p` rule sets font-sans and its own line height, so the line repeats the row's type. */
const LINE_CLASS = 'm-0 text-center font-mono text-meta sm:text-left';

const LINK_CLASS =
  'text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground';

const SEPARATOR_CLASS = 'mx-1 hidden text-faint sm:inline';

export const Footer = memo(() => {
  return (
    <footer className={FOOTER_CLASS}>
      <div className={ROW_CLASS}>
        <p className={LINE_CLASS}>
          <Link className={LINK_CLASS} href="/licenses">
            {SITE_LICENSE}
          </Link>{' '}
          2024-present &#169;{' '}
          <a
            className={LINK_CLASS}
            href="https://github.com/WomB0ComB0"
            target="_blank"
            rel="noreferrer"
          >
            Mike Odnis
          </a>
        </p>

        <div className="flex items-center gap-3 sm:gap-4">
          <nav className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <Link className={LINK_CLASS} href="/licenses">
              Licenses
            </Link>
            <span aria-hidden="true" className={SEPARATOR_CLASS}>
              •
            </span>
            <Link className={LINK_CLASS} href="/privacy">
              Privacy Policy
            </Link>
            <span aria-hidden="true" className={SEPARATOR_CLASS}>
              •
            </span>
            <Link className={LINK_CLASS} href="/cookies">
              Cookie Policy
            </Link>
          </nav>

          <span aria-hidden="true" className={SEPARATOR_CLASS}>
            •
          </span>
          <StatusBadge />
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';
export default Footer;
