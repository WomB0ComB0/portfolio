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

// Never re-export the _interface modules here: they are server-only (urlFor), and client
// components import from this folder.
export { default as DraggableGallery } from './draggable-gallery';
export { default as PinnedRepos } from './pinned-repos';
export {
  PROJECT_GRID_CLASS,
  ProjectCard,
  type ProjectCardData,
  type ProjectCardProps,
  projectHref,
} from './project-card';
export {
  type ProjectFilterOptions,
  type ProjectFilters,
  ProjectsExplorer,
  type ProjectsExplorerProps,
} from './projects-explorer';
export { ProjectsListSkeleton, ProjectsPageFrame } from './projects-skeleton';
export { default as Repository } from './repository';
