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
 * @file /projects as the open Index. There is no loading.tsx (owner: "Drop it on both"), so the
 * rows are in the first HTML and show without JavaScript. The page stays in the (list) route
 * group so list-only files never wrap /projects/[id], whose notFound() must still answer 404.
 * The URL's filters (?q, ?category, ?tech) are read by the island through nuqs, which the
 * dynamic root layout gives the search params during the server render.
 */

import type { JSX } from 'react';
import { Projects } from '@/app/(routes)/(main)/(professioal)/projects/_interface/projects-index';
import { loadProjects } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Projects',
  description: 'Explore my portfolio of web development, machine learning, and software projects',
  path: '/projects',
});

/**
 * Every project in the Index, rendered on the server. A Sanity outage with nothing cached
 * rejects here and reaches the (routes) error view inside the shell.
 */
export default async function ProjectsPage(): Promise<JSX.Element> {
  const projects = await loadProjects();
  return <Projects projects={projects} />;
}
