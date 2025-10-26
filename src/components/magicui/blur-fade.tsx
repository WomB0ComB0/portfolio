'use client';
import type { BlurFadeProps } from './blur-fade.types';

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

import { AnimatePresence, motion, useInView, type Variants } from 'motion/react';
import { useRef } from 'react';
/**
 * BlurFade is a functional React component providing a blur-in and vertical fade-in animation
 * to its immediate children on mount, or as the content scrolls into view (intersection observed).
 * Uses Framer Motion's AnimatePresence and motion.div for smooth visual appearance.
 *
 * @function
 * @public
 * @param {BlurFadeProps} props - Properties configuring animation duration, delay, variants, yOffset, inView options, and blur amount.
 * @param {React.ReactNode} props.children - Child content to animate.
 * @param {string} [props.className] - Container class for further style control.
 * @param {{ hidden: { y: number }, visible: { y: number } }} [props.variant] - Override for default animation variants.
 * @param {number} [props.duration=0.4] - Animation duration in seconds.
 * @param {number} [props.delay=0] - Animation delay (delay after view before animating).
 * @param {number} [props.yOffset=6] - Vertical offset for the initial entry state.
 * @param {boolean} [props.inView=false] - If true, animation will only trigger on entering view.
 * @param {MarginType} [props.inViewMargin='-50px'] - Intersection observer margin for inView logic.
 * @param {string} [props.blur='6px'] - Initial blur of the hidden state in pixels.
 * @returns {JSX.Element} Animated wrapper containing children, fading and blurring on entry or in view.
 * @throws {Error} If used outside a React DOM environment or if Framer Motion is not available.
 * @author Mike Odnis
 * @web
 * @see https://www.framer.com/docs/animate-presence/ {@link AnimatePresence}
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 * <BlurFade duration={0.5} delay={0.2} yOffset={12} inView>
 *   <h1>Animated Title Appears On Scroll</h1>
 * </BlurFade>
 */
export const BlurFade = ({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = '-50px',
  blur = '6px',
}: BlurFadeProps) => {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: 'easeOut',
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
BlurFade.displayName = 'BlurFade';

export default BlurFade;
