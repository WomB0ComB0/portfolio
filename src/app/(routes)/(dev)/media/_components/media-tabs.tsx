'use client';

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

import type { JSX } from 'react';
import { FiFileText, FiMic, FiMonitor, FiRss, FiVideo } from 'react-icons/fi';
import { PageHeader } from '@/components/custom/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArticlesSection } from './articles-section';
import { BlogSection } from './blog-section';
import { PresentationsSection } from './presentations-section';
import { TalksSection } from './talks-section';
import { VideosSection } from './videos-section';

/**
 * @function MediaTabs
 * @description
 *   Main media page component with tabbed interface for different media types.
 *   Includes sections for Blog, Presentations, Talks, Videos, and Articles.
 * @returns {JSX.Element} The React JSX element containing the media tabs.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const MediaTabs = (): JSX.Element => {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Media"
        description="Explore my blog posts, presentations, talks, videos, and articles"
        icon={<FiFileText />}
      />
      <Tabs defaultValue="blog" className="w-full mt-8">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2 h-auto p-2">
          <TabsTrigger value="blog" className="flex items-center gap-2 py-2">
            <FiRss className="w-4 h-4" />
            <span className="hidden sm:inline">Blog</span>
          </TabsTrigger>
          <TabsTrigger value="presentations" className="flex items-center gap-2 py-2">
            <FiMonitor className="w-4 h-4" />
            <span className="hidden sm:inline">Presentations</span>
          </TabsTrigger>
          <TabsTrigger value="talks" className="flex items-center gap-2 py-2">
            <FiMic className="w-4 h-4" />
            <span className="hidden sm:inline">Talks</span>
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2 py-2">
            <FiVideo className="w-4 h-4" />
            <span className="hidden sm:inline">Videos</span>
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex items-center gap-2 py-2">
            <FiFileText className="w-4 h-4" />
            <span className="hidden sm:inline">Articles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blog" className="mt-6">
          <BlogSection />
        </TabsContent>

        <TabsContent value="presentations" className="mt-6">
          <PresentationsSection />
        </TabsContent>

        <TabsContent value="talks" className="mt-6">
          <TalksSection />
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <VideosSection />
        </TabsContent>

        <TabsContent value="articles" className="mt-6">
          <ArticlesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

MediaTabs.displayName = 'MediaTabs';
export default MediaTabs;
