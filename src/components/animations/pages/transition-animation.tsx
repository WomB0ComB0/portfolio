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

import { motion } from 'motion/react';

/**
 * A component that provides a smooth entrance animation for its children using Framer Motion.
 *
 * @component
 * @description
 * TransitionAnimation wraps child components in a motion.div that animates on mount.
 * The animation slides the content upward while fading it in, creating a subtle and professional entrance effect.
 *
 * @param {Object} props - The component props
 * @param {React.ReactNode} props.children - The child elements to be animated
 *
 * @example
 * ```tsx
 * <TransitionAnimation>
 *   <h1>This content will animate in</h1>
 * </TransitionAnimation>
 * ```
 *
 * @animation
 * Initial state:
 * - Translated 20px down (y: 20)
 * - Fully transparent (opacity: 0)
 *
 * Animated state:
 * - Original position (y: 0)
 * - Fully visible (opacity: 1)
 *
 * Animation configuration:
 * - Timing function: easeInOut
 * - Duration: 0.75 seconds
 */
export const TransitionAnimation = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ease: 'easeInOut', duration: 0.75 }}
    >
      {children}
    </motion.div>
  );
};
TransitionAnimation.displayName = 'TransitionAnimation';
export default TransitionAnimation;
