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

import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';
import type { JSX } from 'react';

const MediaView = dynamic(
  () => import('@/app/(routes)/(dev)/media/_interface/media').then((mod) => mod.MediaView),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Media',
  description:
    'Explore my blog posts, presentations, talks, videos, and articles on technology, software development, and more',
});

const MediaPage = (): JSX.Element => {
  return <MediaView />;
};
MediaPage.displayName = 'MediaPage';
export default MediaPage;
