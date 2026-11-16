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
 * @file /experience as a story: the timeline overview, then Now and every year a role began,
 * each role hung off one rail. There is no loading.tsx (owner: "Yes, like the
 * others"), so every role is in the first HTML and reads without JavaScript, as on
 * /certifications and /projects. The page stays in the (list) route group so list-only files
 * never wrap /experience/[id], whose notFound() must still answer 404.
 */

import type { JSX } from 'react';
import { nyToday } from '@/app/_components/home/data/format';
import { RoleStory } from '@/app/(routes)/(main)/(professioal)/experience/_interface/role-story/role-story';
import { loadExperiences } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Experience',
  description: 'Where I work now and where I worked before: roles, organizations and dates.',
  path: '/experience',
});

/**
 * Every role, rendered on the server as the story, on a clock that ends in today's month in New
 * York. The roles answer from the process's stale cache (5 min fresh; Sanity asked with a 4 s
 * timeout and one retry), so a slow Sanity never holds the page past about 8 s, and a Sanity
 * failure with nothing cached rejects here and reaches the shell's error boundary, not an empty
 * page. The technologies are quiet words here (each role's page links them into /projects), so
 * the projects are not loaded.
 */
const ExperiencePage = async (): Promise<JSX.Element> => {
  const experiences = await loadExperiences();
  return <RoleStory experiences={experiences} today={nyToday()} />;
};
ExperiencePage.displayName = 'ExperiencePage';
export default ExperiencePage;
