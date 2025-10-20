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
import { constructMetadata } from '@/utils';

const Resume = dynamic(
  () => import('@/app/(routes)/(main)/resume/_interface/resume').then((mod) => mod.Resume),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Resume',
  description: 'View and download my professional resume',
});

/**
 * Resume page component.
 * Renders the resume interface for viewing and downloading the professional resume.
 *
 * @returns {JSX.Element} The resume page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const ResumePage = () => {
  return <Resume />;
};

export default ResumePage;
