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

/**
 * @fileoverview The "Page not found" view shown inside the site shell.
 *
 * A server component with no hooks, context or motion, so it renders the same on the server, in
 * a client tree and without JavaScript. The shell around it provides the nav, footer, background
 * and full-height layout, so this view adds none of them.
 */

import { Home } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

/** Ties the section's accessible name to its heading. */
const TITLE_ID = 'not-found-title';

/**
 * The 404 view: a decorative numeral, a heading, a way back (Home, Projects) and a hint that the
 * command palette can search the site.
 */
export function NotFoundView(): JSX.Element {
  return (
    <section
      aria-labelledby={TITLE_ID}
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 px-6 py-20 text-center sm:py-28"
    >
      <div className="flex flex-col items-center">
        {/* Decorative: the heading below already says what happened. */}
        <p
          aria-hidden="true"
          className="select-none bg-linear-to-b from-primary/70 via-primary/25 to-transparent bg-clip-text text-[clamp(6rem,3rem+14vw,10rem)] font-black leading-none tracking-tighter text-transparent tabular-nums"
        >
          404
        </p>
        {/* Pulled up into the numeral's faded lower half, so the two read as one block. */}
        <h1 id={TITLE_ID} className="-mt-4 text-3xl text-foreground sm:-mt-6 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground">This page doesn&apos;t exist, or it moved.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ size: 'lg' })}>
          <Home aria-hidden="true" />
          Home
        </Link>
        <Link href="/projects" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          Projects
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Press <Kbd>⌘K</Kbd> (<Kbd>Ctrl K</Kbd> on Windows and Linux) to search
      </p>
    </section>
  );
}
