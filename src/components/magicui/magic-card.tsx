'use client';
import type { MagicCardProps } from './magic-card.types';

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

import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';
/**
 * MagicCard is a React component that adds a dynamic radial gradient "spotlight"
 * effect that follows the user's mouse position inside the card.
 *
 * This effect is commonly used for interactive UI cards. Utilizes Framer Motion's
 * reactive motion values for smooth, performant effects.
 *
 * @function
 * @param {MagicCardProps} props - Props for the MagicCard component.
 * @param {React.ReactNode} props.children - Child nodes to render within the MagicCard.
 * @param {string} [props.className] - Additional CSS class names applied to the card.
 * @param {number} [props.gradientSize=200] - The diameter of the radial gradient in px.
 * @param {string} [props.gradientColor='rgba(76, 29, 149, 0.15)'] - The CSS color of the gradient.
 * @param {number} [props.gradientOpacity=0.8] - Opacity for the gradient overlay.
 *
 * @returns {JSX.Element} A div element styled as an interactive card with spotlight gradient, containing children.
 *
 * @throws {Error} Prop values such as invalid types (e.g. non-number for gradientSize) may cause React runtime warnings.
 *
 * @example
 * <MagicCard gradientSize={300} gradientColor="rgba(255,0,0,0.3)">
 *   <p>Hover me for a magic spotlight!</p>
 * </MagicCard>
 *
 * @web
 * @see {@link https://www.framer.com/docs/motion-value/}
 * @see MagicCardProps
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 */
export const MagicCard = ({
  children,
  className,
  gradientSize = 200,
  gradientColor = 'rgba(76, 29, 149, 0.15)',
  gradientOpacity = 0.8,
}: MagicCardProps) => {
  /**
   * s@readonly
   * @type {import('motion').MotionValue<number>}
   * Reactive motion value for mouse X coordinate (relative to card)
   */
  const mouseX = useMotionValue(-gradientSize);

  /**
   * @readonly
   * @type {import('motion').MotionValue<number>}
   * Reactive motion value for mouse Y coordinate (relative to card)
   */
  const mouseY = useMotionValue(-gradientSize);

  /**
   * Handler for mouse movement over the card. Updates spotlight's origin.
   *
   * @param {React.MouseEvent<HTMLDivElement>} e - The mouse event.
   * @returns {void}
   * @private
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { left, top } = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - left);
      mouseY.set(e.clientY - top);
    },
    [mouseX, mouseY],
  );

  /**
   * Handler for mouse leaving the card. Hides the gradient.
   *
   * @returns {void}
   * @private
   */
  const handleMouseLeave = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  useEffect(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative flex size-full overflow-hidden rounded-xl bg-primary/5 dark:bg-primary border border-primary dark:border-primary/70 text-primary dark:text-primary',
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)
          `,
          opacity: gradientOpacity,
        }}
      />
    </div>
  );
};
MagicCard.displayName = 'MagicCard';

export default MagicCard;
