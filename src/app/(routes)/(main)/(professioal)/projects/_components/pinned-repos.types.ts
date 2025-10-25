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

import type { PinnedRepo } from '@/lib/api-integrations/get-repos';

/**
 * Interface for the properties accepted by {@link PinnedRepos} component.
 *
 * @interface PinnedReposProps
 * @property {PinnedRepo[]} pinnedRepos - Array of pinned repositories to display as cards.
 * @property {boolean} [isLoading=false] - State indicating if repositories are loading.
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @readonly
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @public
 */
export interface PinnedReposProps {
  pinnedRepos: PinnedRepo[];
  isLoading?: boolean;
}
