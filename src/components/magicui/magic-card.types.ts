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
 * Props for the {@link MagicCard} component.
 *
 * @interface MagicCardProps
 * @extends React.HTMLAttributes<HTMLDivElement>
 * @property {number} [gradientSize] - The diameter of the radial gradient spotlight effect, in pixels.
 * @property {string} [gradientColor] - The CSS color string for the gradient. Defaults to a purple-tinted rgba.
 * @property {number} [gradientOpacity] - Opacity of the radial gradient overlay (0-1).
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
