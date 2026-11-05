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

import { motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { cn } from '@/lib/utils';
import type { PageMainProps } from './page-transition.types';

/** The id of the page's `<main>`, which the page Layout's skip link targets. */
export const MAIN_CONTENT_ID = 'main-content';

const PAGE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
};

const ENTER_TRANSITION = { duration: 0.2, ease: 'easeInOut' } as const;

/**
 * The page's `<main>` landmark. The page Layout puts it around the page content only, so the
 * navs and the footer stay outside it, and `tabIndex={-1}` lets the skip link move focus here.
 *
 * The server HTML and its hydration render the same element in its final, visible state, so
 * hydration keeps the server DOM and the page works before (and without) JavaScript. A page
 * mounted by a client-side navigation fades and slides in instead; MotionConfig
 * reducedMotion="user" in the providers drops the slide for people who ask for less motion.
 */
export const PageMain = ({ children, className }: PageMainProps) => {
  const isServerHtml = useIsServerHtmlRender();
  // Fixed at mount: the store reads false right after hydration, which must not start the animation.
  const [initial] = useState<false | 'hidden'>(isServerHtml ? false : 'hidden');

  return (
    <motion.main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className={cn('outline-none', className)}
      variants={PAGE_VARIANTS}
      initial={initial}
      animate="enter"
      transition={ENTER_TRANSITION}
    >
      {children}
    </motion.main>
  );
};
PageMain.displayName = 'PageMain';
