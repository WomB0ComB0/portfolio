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
import { NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { StatusBadge } from '@/components/custom/status-badge';

/** The SPDX id in package.json and LICENSE; /licenses explains what it covers. */
const SITE_LICENSE = 'Apache-2.0';

/**
 * As wide as the page column and centred under it, with the page gutter inside. The shell's
 * column already clears the desktop rail, so the footer needs no offset of its own.
 */
const FOOTER_CLASS =
  '@container/footer mx-auto mt-auto w-full max-w-shell border-t border-hairline px-(--page-gutter) py-6';

/**
 * Stacked and centred until the footer itself is 52rem wide, where the licence line and the links
 * fit side by side on one line. It answers to the footer's own width, not the viewport's: beside
 * the desktop rail the column is narrower than the screen.
 */
const ROW_CLASS =
  'flex flex-col items-center gap-3 font-mono text-meta text-muted-foreground @min-[52rem]/footer:flex-row @min-[52rem]/footer:justify-between';

/** The base `p` rule sets font-sans and its own line height, so the line repeats the row's type. */
const LINE_CLASS = 'm-0 text-center font-mono text-meta @min-[52rem]/footer:text-left';

/** The links wrap on a phone (no separators there) and stay on one line from a 34rem footer. */
const NAV_CLASS =
  'flex flex-wrap justify-center gap-2 @min-[34rem]/footer:flex-nowrap @min-[34rem]/footer:gap-3 @min-[34rem]/footer:whitespace-nowrap';

const LINK_CLASS =
  'text-brand-ink underline decoration-dotted underline-offset-4 transition-colors duration-(--motion-fast) ease-standard hover:text-foreground';

/**
 * The links' landmark name: the three legal pages, as the phone menu's group calls them. The
 * shell's other nav landmarks are named, so this one must not be a bare "navigation".
 */
const NAV_LABEL = 'Legal';

/** Shown only where the links cannot wrap, so a separator never ends a line or sits alone. */
const SEPARATOR_CLASS = 'mx-1 hidden text-faint @min-[34rem]/footer:inline';

/**
 * The links, then the status pill. On a phone the two no longer fit one line (the pill shows its
 * word at every width), so the pill wraps below the links, centred, rather than squeezing them.
 */
const END_ROW_CLASS =
  'flex flex-wrap items-center justify-center gap-x-3 gap-y-2 @min-[34rem]/footer:gap-4';

export const Footer = memo(() => {
  return (
    <footer className={FOOTER_CLASS}>
      <div className={ROW_CLASS}>
        <p className={LINE_CLASS}>
          <Link className={LINK_CLASS} href="/licenses">
            {SITE_LICENSE}
          </Link>{' '}
          2024–present &#169;{' '}
          <a
            className={LINK_CLASS}
            href="https://github.com/WomB0ComB0"
            target="_blank"
            rel="noreferrer"
          >
            Mike Odnis
            <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
          </a>
        </p>

        <div className={END_ROW_CLASS}>
          <nav aria-label={NAV_LABEL} className={NAV_CLASS}>
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
