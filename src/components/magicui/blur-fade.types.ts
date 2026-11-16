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

/*!
 * Props extracted from this repository's adaptation of Magic UI's Blur Fade.
 * Upstream source: https://github.com/magicuidesign/magicui/blob/abd8263bc34dcc2e9c2f17c0a2ea58962cc153eb/registry/components/magicui/blur-fade.tsx
 * Upstream portions retain the following MIT notice. The existing copyright and
 * Apache-2.0 notice above applies to this repository's modifications.
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { UseInViewOptions } from 'motion/react';

/**
 * @interface BlurFadeProps
 * @public
 * @description
 * Props for the {@link BlurFade} component controlling animated blur and fade-in transitions for child content.
 * @property {React.ReactNode} children - Content to be wrapped with the blur-fade effect.
 * @property {string} [className] - Additional class names for styling the container.
 * @property {{ hidden: { y: number }, visible: { y: number } }} [variant] - Custom animation variants to override default blur/fade motion.
 * @property {number} [duration] - Duration of animation in seconds. Defaults to 0.4.
 * @property {number} [delay] - Animation delay in seconds. Defaults to 0.
 * @property {number} [yOffset] - Pixel offset (positive value) for vertical animation on entry/exit. Defaults to 6.
 * @property {boolean} [inView] - If true, triggers animation only once when element is in view. Defaults to false for always animate.
 * @property {MarginType} [inViewMargin] - "margin" root option for `useInView`. Defaults to '-50px'.
 * @property {string} [blur] - The initial blur amount to apply in pixels (e.g. '6px'). Defaults to '6px'.
 * @author Mike Odnis
 * @web
 * @see https://www.framer.com/motion/
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @readonly
 */
export interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: MarginType;
  blur?: string;
}

export type MarginType = UseInViewOptions['margin'];
