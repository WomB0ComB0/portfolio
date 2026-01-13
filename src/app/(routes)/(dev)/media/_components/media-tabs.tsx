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

import { PageHeader } from '@/components/custom/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryState } from 'nuqs';
import type { ComponentType, JSX } from 'react';
import type { IconBaseProps } from 'react-icons';
import { FiFileText, FiMic, FiMonitor, FiRss, FiVideo } from 'react-icons/fi';
import { ArticlesSection } from './articles-section';
import { BlogSection } from './blog-section';
import { PresentationsSection } from './presentations-section';
import { TalksSection } from './talks-section';
import { VideosSection } from './videos-section';

interface TabConfig {
  value: string;
  label: string;
  ariaLabel: string;
  icon: ComponentType<IconBaseProps>;
  content: ComponentType;
}

const TABS_CONFIG: TabConfig[] = [
  { value: 'blog', label: 'Blog', ariaLabel: 'Blog posts', icon: FiRss, content: BlogSection },
  {
    value: 'presentations',
    label: 'Presentations',
    ariaLabel: 'Presentations',
    icon: FiMonitor,
    content: PresentationsSection,
  },
  { value: 'talks', label: 'Talks', ariaLabel: 'Talks', icon: FiMic, content: TalksSection },
  { value: 'videos', label: 'Videos', ariaLabel: 'Videos', icon: FiVideo, content: VideosSection },
  {
    value: 'articles',
    label: 'Articles',
    ariaLabel: 'Articles',
    icon: FiFileText,
    content: ArticlesSection,
  },
];

const TAB_TRIGGER_CLASSES = [
  'flex-1 min-w-[110px] sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300',
  'text-muted-foreground',
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-105',
  '[&[data-state=active]>*]:text-primary-foreground',
  'hover:bg-accent/50 hover:text-foreground hover:scale-102',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:bg-accent/80 focus-visible:text-foreground',
].join(' ');

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
    <div className="container mx-auto px-4 py-8 lg:py-12">
      <PageHeader
        title="Media"
        description="Explore my blog posts, presentations, talks, videos, and articles"
        icon={<FiFileText />}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-10">
        <TabsList
          className="w-full flex flex-wrap justify-center gap-2 h-auto p-3 bg-muted/30 backdrop-blur-md rounded-2xl border border-border/40 shadow-lg"
          role="tablist"
          aria-label="Media categories"
        >
          {TABS_CONFIG.map(({ value, label, ariaLabel, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={TAB_TRIGGER_CLASSES}
              aria-label={ariaLabel}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS_CONFIG.map(({ value, content: Content }) => (
          <TabsContent key={value} value={value} className="mt-10">
            <Content />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

MediaTabs.displayName = 'MediaTabs';
export default MediaTabs;
