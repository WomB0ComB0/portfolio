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

import dynamic from 'next/dynamic';
import type { JSX } from 'react';
import { constructMetadata } from '@/utils';

const ExperienceList = dynamic(
  () =>
    import('@/app/(routes)/(main)/experience/_interface/experience-list').then(
      (mod) => mod.ExperienceList,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Experience',
  description: 'Explore my professional work experience and career journey',
});

const ExperiencePage = (): JSX.Element => {
  return <ExperienceList />;
};
ExperiencePage.displayName = 'ExperiencePage';
export default ExperiencePage;
