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
 * @file /projects. It lives in the (list) route group so that its loading.tsx wraps this page
 * only: a skeleton above /projects/[id] would stream a 200 before that page's notFound() runs.
 */

import type { JSX } from 'react';
import {
  ProjectsList,
  toProjectCard,
} from '@/app/(routes)/(main)/(professioal)/projects/_interface/projects-list';
import { loadProjects } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Projects',
  description: 'Explore my portfolio of web development, machine learning, and software projects',
  path: '/projects',
});

/**
 * Every project, rendered on the server. A Sanity outage with nothing cached rejects here and
 * reaches the (routes) error view inside the shell.
 */
export default async function ProjectsPage(): Promise<JSX.Element> {
  const projects = await loadProjects();
  return <ProjectsList projects={projects.map(toProjectCard)} />;
}
