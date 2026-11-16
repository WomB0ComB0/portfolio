/**
 * Copyright 2026 Mike Odnis
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
 * @file Classes the /sponsor sections share. No directive: server components import them.
 */

/**
 * A section's h2 as a quiet sentence-case label ("Ways to sponsor"), so the rows under it carry
 * the weight and the page title keeps the only large type.
 */
export const SECTION_LABEL_CLASS = 'tile-label text-muted-foreground';

/**
 * A name link in running text: brand-ink on hover, colour only. The underline is on the name's
 * own span (NAME_UNDERLINE_CLASS), not the link: the link also holds the new-tab arrow and a
 * space before its spoken words, and once anything followed the link ("now") that space was
 * underlined too, as a stub after the arrow.
 */
export const NAME_LINK_CLASS =
  'group/name font-medium text-foreground transition-colors duration-(--motion-base) ease-effect hover:text-brand-ink';

/** The name itself: underlined in hairline, brand-ink while its link is hovered. */
export const NAME_UNDERLINE_CLASS =
  'underline decoration-hairline-strong underline-offset-4 transition-colors duration-(--motion-base) ease-effect group-hover/name:decoration-brand-ink';
