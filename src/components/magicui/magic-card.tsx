
'use client';

import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import type React from 'react';
import { useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';

/**
 * Props for the {@link MagicCard} component.
 *
 * @interface MagicCardProps
 * @extends React.HTMLAttributes<HTMLDivElement>
 * @property {number} [gradientSize] - The diameter of the radial gradient spotlight effect, in pixels.
 * @property {string} [gradientColor] - The CSS color string for the gradient. Defaults to a purple-tinted rgba.
 * @property {number} [gradientOpacity] - Opacity of the radial gradient overlay (0-1).
 *
 * @author Mike Odnis
 * @see {@link https://github.com/WomB0ComB0/portfolio}
 * @version 1.0.0
 * @public
 */
export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
}

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
export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = 'rgba(76, 29, 149, 0.15)',
  gradientOpacity = 0.8,
}: MagicCardProps) {
  /**
   * @readonly
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
        'group relative flex size-full overflow-hidden rounded-xl bg-[#ba9bdd]-50 dark:bg-[#ba9bdd] border border-[#ba9bdd] dark:border-[#ba9bdd]-700 text-[#ba9bdd] dark:text-[#ba9bdd]',
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
}

