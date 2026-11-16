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
 * Props extracted from this repository's adaptation of Magic UI's Border Beam.
 * Upstream source: https://github.com/magicuidesign/magicui/blob/abd8263bc34dcc2e9c2f17c0a2ea58962cc153eb/registry/components/magicui/border-beam.tsx
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

/**
 * @interface BorderBeamProps
 * @readonly
 * @public
 * @description
 * Props for the {@link BorderBeam} component, controlling the animated border beam effect.
 * @property {string} [className] - Additional CSS class names to apply to the beam container.
 * @property {number} [size] - Diameter of the beam effect in pixels. Default is 200.
 * @property {number} [duration] - Duration in seconds for the animation loop. Default is 15.
 * @property {number} [borderWidth] - Width of the border in pixels. Default is 1.5.
 * @property {number} [anchor] - Anchor point (as a percentage) for the animation. Default is 90.
 * @property {string} [colorFrom] - CSS color string where the border beam starts. Default is '#ffaa40'.
 * @property {string} [colorTo] - CSS color string where the border beam ends. Default is '#9c40ff'.
 * @property {number} [delay] - Animation delay in seconds. Default is 0.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}
