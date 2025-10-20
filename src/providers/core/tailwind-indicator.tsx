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
 * A development-only component that displays the current Tailwind CSS breakpoint.
 * This visual indicator helps developers see which responsive breakpoint is active
 * during development and testing.
 *
 * @component
 * @returns {React.JSX.Element|null} Returns the breakpoint indicator component in development,
 *                            or null in production
 *
 * @example
 * ```tsx
 * // In your layout or page component:
 * <TailwindIndicator />
 * ```
 *
 * @remarks
 * The component shows different text based on the current viewport width:
 * - xs: < 640px
 * - sm: 640px - 767px
 * - md: 768px - 1023px
 * - lg: 1024px - 1279px
 * - xl: 1280px - 1535px
 * - 2xl: >= 1536px
 *
 * The indicator appears as a small circular badge in the bottom-left corner with:
 * - Fixed positioning
 * - z-index of 50 to stay above other content
 * - Dark gray background
 * - White monospace text
 * - Centered content
 *
 * @see {@link https://tailwindcss.com/docs/responsive-design} Tailwind CSS breakpoints documentation
 */
export const TailwindIndicator = () => {
  // Don't show in production
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div className="fixed bottom-12 left-3 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 p-3 font-mono text-xs text-white">
      <div className="block sm:hidden">xs</div>
      <div className="hidden sm:block md:hidden">sm</div>
      <div className="hidden md:block lg:hidden">md</div>
      <div className="hidden lg:block xl:hidden">lg</div>
      <div className="hidden xl:block 2xl:hidden">xl</div>
      <div className="hidden 2xl:block">2xl</div>
    </div>
  );
};
TailwindIndicator.displayName = 'TailwindIndicator';
export default TailwindIndicator;
