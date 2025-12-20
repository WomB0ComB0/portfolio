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
import { useQueryState } from 'nuqs';
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
 *   Tab state is persisted in URL query parameters for shareable links.
 * @returns {JSX.Element} The React JSX element containing the media tabs.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const MediaTabs = (): JSX.Element => {
  const [activeTab, setActiveTab] = useQueryState('tab', {
    defaultValue: 'blog',
    shallow: true,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Media"
        description="Explore my blog posts, presentations, talks, videos, and articles"
        icon={<FiFileText />}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
        <TabsList className="w-full flex flex-wrap justify-center gap-1 sm:gap-2 h-auto p-2 bg-muted/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm">
          <TabsTrigger
            value="blog"
            className="flex-1 min-w-[100px] sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted-foreground/10"
          >
            <FiRss className="w-4 h-4" />
            <span>Blog</span>
          </TabsTrigger>
          <TabsTrigger
            value="presentations"
            className="flex-1 min-w-[100px] sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted-foreground/10"
          >
            <FiMonitor className="w-4 h-4" />
            <span>Presentations</span>
          </TabsTrigger>
          <TabsTrigger
            value="talks"
            className="flex-1 min-w-[100px] sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted-foreground/10"
          >
            <FiMic className="w-4 h-4" />
            <span>Talks</span>
          </TabsTrigger>
          <TabsTrigger
            value="videos"
            className="flex-1 min-w-[100px] sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted-foreground/10"
          >
            <FiVideo className="w-4 h-4" />
            <span>Videos</span>
          </TabsTrigger>
          <TabsTrigger
            value="articles"
            className="flex-1 min-w-[100px] sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted-foreground/10"
          >
            <FiFileText className="w-4 h-4" />
            <span>Articles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blog" className="mt-8">
          <BlogSection />
        </TabsContent>

        <TabsContent value="presentations" className="mt-8">
          <PresentationsSection />
        </TabsContent>

        <TabsContent value="talks" className="mt-8">
          <TalksSection />
        </TabsContent>

        <TabsContent value="videos" className="mt-8">
          <VideosSection />
        </TabsContent>

        <TabsContent value="articles" className="mt-8">
          <ArticlesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

MediaTabs.displayName = 'MediaTabs';
export default MediaTabs;
