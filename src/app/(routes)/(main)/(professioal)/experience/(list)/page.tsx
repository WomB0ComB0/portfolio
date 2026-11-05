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
 * @file /experience. It lives in the (list) route group so that its loading.tsx wraps this page
 * only: a loading boundary above /experience/[id] would answer 200 before notFound() runs.
 */

import type { JSX } from 'react';
import { ExperienceList } from '@/app/(routes)/(main)/(professioal)/experience/_interface/experience-list';
import { loadExperiences } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Experience',
  description: 'Explore my professional work experience and career journey',
  path: '/experience',
});

/**
 * Renders every experience on the server. A Sanity failure with nothing cached rejects here and
 * reaches the shell's error boundary, rather than showing an empty timeline.
 */
const ExperiencePage = async (): Promise<JSX.Element> => {
  return <ExperienceList experiences={await loadExperiences()} />;
};
ExperiencePage.displayName = 'ExperiencePage';
export default ExperiencePage;
