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
