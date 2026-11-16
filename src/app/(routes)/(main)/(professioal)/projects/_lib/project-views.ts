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
 * @file The three views of /projects in the URL, pure and server-safe: Stories (the default, no
 * parameter, so old links and the canonical URL stay as they were), Index (?view=index, a
 * contents page in words) and Screens (?view=screens, every project's images as the /places
 * photo wall). The filters (?q, ?category, ?tech) apply to every view and are carried across.
 */

import { parseView, viewHref } from '@/components/console/folio/view-href';
import { PROJECTS_PATH } from './project-schema';

export const PROJECT_VIEWS = [
  { value: 'stories', label: 'Stories' },
  { value: 'index', label: 'Index' },
  { value: 'screens', label: 'Screens' },
] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number]['value'];

export const DEFAULT_PROJECT_VIEW: ProjectView = 'stories';
export const VIEW_PARAM = 'view';

const VIEW_VALUES: readonly ProjectView[] = PROJECT_VIEWS.map((view) => view.value);

/** The view a URL asks for; anything unknown is Stories. */
export const parseProjectView = (raw: string | readonly string[] | undefined): ProjectView =>
  parseView(raw, VIEW_VALUES, DEFAULT_PROJECT_VIEW);

/**
 * The view's own path, the base every filter link and the search form start from: '/projects'
 * for Stories, '/projects?view=index' for the others.
 */
export const projectViewPath = (view: ProjectView): string =>
  viewHref(PROJECTS_PATH, view, { defaultView: DEFAULT_PROJECT_VIEW, param: VIEW_PARAM });
