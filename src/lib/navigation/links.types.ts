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

import type { IconType } from 'react-icons/lib';

/**
 * @interface Link
 * @description
 * Represents a navigable external resource or social profile.
 * Used in the navigation system to unify social and project links.
 * @property {string} name - The display name of the resource.
 * @property {string} url - The external URL pointing to the resource or profile.
 * @property {string} value - The user handle, id, or unique value associated with the link.
 * @property {IconType} icon - The icon representing this resource (from react-icons).
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://github.com/WomB0ComB0/portfolio
 */
export type Link = {
  name: string;
  url: string;
  value: string;
  icon: IconType;
};
/**
 * @typedef {Link[]} Links
 * @description
 * An array of {@link Link} entries, each representing a social profile, project, or developer platform.
 * Used by UI navigation components to dynamically render social and external links.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://github.com/WomB0ComB0/portfolio
 */
export type Links = Link[];
