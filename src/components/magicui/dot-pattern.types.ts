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
 * @interface DotPatternProps
 * @readonly
 * @public
 * @description
 * Props for the {@link DotPattern} component controlling SVG pattern settings.
 * @property {number} [width] - Width of the SVG pattern tile in pixels. Default: 16.
 * @property {number} [height] - Height of the SVG pattern tile in pixels. Default: 16.
 * @property {number} [x] - Horizontal offset of the pattern. Default: 0.
 * @property {number} [y] - Vertical offset of the pattern. Default: 0.
 * @property {number} [cx] - X coordinate of the dot's center within the tile. Default: 1.
 * @property {number} [cy] - Y coordinate of the dot's center within the tile. Default: 1.
 * @property {number} [cr] - Radius of the dot. Default: 0.5.
 * @property {string} [className] - Additional class names for SVG styling.
 * @author Mike Odnis
 * @web
 * @see https://developer.mozilla.org/docs/Web/SVG/Element/pattern
 * @version 1.0.0
 */
export interface DotPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
}
