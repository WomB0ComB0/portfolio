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

import type { ReactNode } from 'react';
import type { Project } from '@/hooks/sanity/schemas';
import type { LineProject } from '../../_components/detail/case-line';
import type { OrderableProject } from '../../_lib/project-order';

export interface ProjectDetailProps {
  /** The project the page found; an unknown id 404s in the page before this renders. */
  project: Project;
  /**
   * Every project, for 'Where it sits' (its place on the time line and its named neighbours) and
   * for whether /projects lists it as Featured (the breadcrumb then leads there): the page's own
   * list, already loaded for the lookup. Without it the band shows the project alone on its line.
   */
  projects?: readonly (LineProject & OrderableProject)[];
  /** Shown after the case study, above "Back to all projects": the page's See also. */
  children?: ReactNode;
}
