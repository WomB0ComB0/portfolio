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

import type { JSX, ReactNode } from 'react';
import { FiFileText } from 'react-icons/fi';
import { MediaTabs } from '@/app/(routes)/(dev)/media/_components/media-tabs';
import type { MediaTab } from '@/app/(routes)/(dev)/media/_lib/media-tabs';
import { PageHeader } from '@/components/custom/page-header';

export interface MediaViewProps {
  /** The tab `panel` belongs to. */
  readonly active: MediaTab;
  /** The active tab's panel, or its skeleton. */
  readonly panel: ReactNode;
}

/**
 * Media view component, rendered on the server.
 * Renders the media page header and the tab bar around the active tab's panel.
 *
 * @returns {JSX.Element} The media view.
 * @author Mike Odnis
 * @version 2.0.0
 */
export const MediaView = ({ active, panel }: MediaViewProps): JSX.Element => {
  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto mb-10">
        <div className="container mx-auto px-4 py-8 lg:py-12">
          <PageHeader
            title="Media"
            description="Explore my blog posts, presentations, talks, videos, and articles"
            icon={<FiFileText />}
          />
          <MediaTabs active={active}>{panel}</MediaTabs>
        </div>
      </div>
    </div>
  );
};
MediaView.displayName = 'MediaView';
export default MediaView;
