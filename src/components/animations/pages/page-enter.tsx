'use client';

/**
 * Copyright 2026 Mike Odnis
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

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { DURATION_MS, EASE, prefersReducedMotion, seconds } from '@/lib/design/motion';

type PageEnterProps = Readonly<{ children: React.ReactNode }>;

/** Where a client-mounted page starts. Opacity only: no slide, so nothing shifts the layout. */
const HIDDEN = { opacity: 0 } as const;
const SHOWN = { opacity: 1 } as const;
const FADE = { duration: seconds(DURATION_MS.fast), ease: EASE.outExpo } as const;

/**
 * Whether a frame mounting now starts hidden. Server HTML (and its hydration) renders in its final
 * state, so the page is visible before and without JavaScript. Reduced motion skips the fade too:
 * the app's MotionConfig reducedMotion="user" stops transforms but still plays opacity.
 */
const startsHidden = (isServerHtml: boolean): boolean => !isServerHtml && !prefersReducedMotion();

/**
 * One page's fade-in. It captures at mount whether it is server HTML (or its hydration); a frame
 * mounted by a client navigation starts hidden and fades in, unless the visitor asked for
 * reduced motion.
 */
const PageEnterFrame = ({ children }: PageEnterProps) => {
  const isServerHtml = useIsServerHtmlRender();
  // Fixed at mount: the store reads false right after hydration, which must not start the fade.
  const [initial] = useState<false | typeof HIDDEN>(() =>
    startsHidden(isServerHtml) ? HIDDEN : false,
  );

  return (
    <motion.div initial={initial} animate={SHOWN} transition={FADE}>
      {children}
    </motion.div>
  );
};

/**
 * Fades the page in on each client navigation while the shell around it stays mounted.
 *
 * The frame is keyed by pathname, so a new path mounts a new frame (and remounts the page under
 * it) that plays the fade again; a change of search params alone keeps the page mounted. There
 * is no exit animation: the old page is replaced at once.
 */
export const PageEnter = ({ children }: PageEnterProps) => {
  const pathname = usePathname();
  return <PageEnterFrame key={pathname}>{children}</PageEnterFrame>;
};
PageEnter.displayName = 'PageEnter';
