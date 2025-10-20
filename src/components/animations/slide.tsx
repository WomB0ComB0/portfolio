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
import { motion, useAnimation, useInView } from 'motion/react';
import { useEffect, useRef } from 'react';

type props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export const Slide = ({ children, className, delay }: props) => {
  const ref = useRef(null);
  const isInview = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInview) {
      controls.start('stop');
    }
  }, [controls, isInview]);

  return (
    <motion.div
      ref={ref}
      variants={{
        start: { opacity: 0, translateY: 10 },
        stop: { opacity: 1, translateY: 0 },
      }}
      transition={{
        ease: 'easeInOut',
        duration: 0.3,
        delay: delay,
        stiffness: 0.5,
      }}
      animate={controls}
      initial="start"
      className={className}
    >
      {children}
    </motion.div>
  );
};
Slide.displayName = 'Slide';
export default Slide;
