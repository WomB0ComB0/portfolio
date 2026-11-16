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

export { default as DraggableGallery } from './draggable-gallery';
// Never re-export the _interface modules here: they are server-only (urlFor), and client
// components import from this folder. The project page's own parts (its case study in
// _components/detail/) are imported by path, not through here, so the project page can change
// them on its own.
export { LeadStory, type LeadStoryProps } from './lead-story';
export { type BriefLayout, ProjectBrief, type ProjectBriefProps } from './project-brief';
export { ProjectContents, type ProjectContentsProps } from './project-contents';
export { PROJECTS_DESCRIPTION, PROJECTS_TITLE, ProjectsByline } from './project-header';
export { ProjectScreens, type ProjectScreensProps } from './project-screens';
export { ProjectStories, type ProjectStoriesProps } from './project-stories';
export { ProjectsIndex, type ProjectsIndexProps } from './projects-index';
export { StoryActions, StoryCover, type StoryCoverProps, StoryLink } from './story-parts';
