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

import { parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  type ComponentType,
  type JSX,
  type ReactNode,
  type TransitionStartFunction,
  useTransition,
} from 'react';
import type { IconBaseProps } from 'react-icons';
import { FiFileText, FiMic, FiMonitor, FiRss, FiVideo } from 'react-icons/fi';
import {
  DEFAULT_MEDIA_TAB,
  MEDIA_TAB_LABELS,
  MEDIA_TABS,
  type MediaTab,
  parseMediaTab,
} from '@/app/(routes)/(dev)/media/_lib/media-tabs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const TAB_ICONS: Readonly<Record<MediaTab, ComponentType<IconBaseProps>>> = {
  blog: FiRss,
  presentations: FiMonitor,
  talks: FiMic,
  videos: FiVideo,
  articles: FiFileText,
};

const TAB_ARIA_LABELS: Readonly<Record<MediaTab, string>> = {
  blog: 'Blog posts',
  presentations: 'Presentations',
  talks: 'Talks',
  videos: 'Videos',
  articles: 'Articles',
};

const TAB_TRIGGER_CLASSES = [
  'flex-1 min-w-[110px] sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300',
  'text-muted-foreground',
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:scale-105',
  '[&[data-state=active]>*]:text-primary-foreground',
  'hover:bg-accent/50 hover:text-foreground hover:scale-102',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:bg-accent/80 focus-visible:text-foreground',
].join(' ');

/**
 * `?tab=` as the tab bar writes it. A change is a server navigation (not shallow), pushed so
 * Back returns to the previous tab, without scrolling, and inside `startTransition` so the old
 * panel stays (dimmed) until the new one starts streaming.
 */
const useTabParam = (startTransition: TransitionStartFunction) =>
  useQueryState(
    'tab',
    parseAsStringLiteral(MEDIA_TABS)
      .withDefault(DEFAULT_MEDIA_TAB)
      .withOptions({ shallow: false, history: 'push', scroll: false, startTransition }),
  );

export interface MediaTabsProps {
  /**
   * The tab the server rendered `children` for. The bar marks it, not the URL's tab, so after a
   * click the old tab stays selected until the server's render of the new tab starts streaming.
   */
  readonly active: MediaTab;
  /** The active tab's panel. */
  readonly children: ReactNode;
}

/**
 * @function MediaTabs
 * @description
 *   The /media tab bar. The server renders the active tab's panel and passes it in as children;
 *   choosing a tab writes `?tab=` and navigates, so the server renders the new tab's panel
 *   while this bar (and the header above it) stays mounted. Tabs activate on click, Enter or
 *   Space, not on arrow-key focus, since each activation is a server round trip.
 * @returns {JSX.Element} The tab bar with the active panel.
 * @web
 * @public
 * @author Mike Odnis
 * @version 2.0.0
 */
export const MediaTabs = ({ active, children }: MediaTabsProps): JSX.Element => {
  const [isPending, startTransition] = useTransition();
  const [, setTab] = useTabParam(startTransition);

  return (
    <Tabs
      value={active}
      onValueChange={(value) => void setTab(parseMediaTab(value))}
      activationMode="manual"
      className="w-full mt-10"
    >
      <TabsList
        className="w-full flex flex-wrap justify-center gap-2 h-auto p-3 bg-muted/30 backdrop-blur-md rounded-2xl border border-border/40 shadow-lg"
        aria-label="Media categories"
      >
        {MEDIA_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab];
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className={TAB_TRIGGER_CLASSES}
              aria-label={TAB_ARIA_LABELS[tab]}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{MEDIA_TAB_LABELS[tab]}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {MEDIA_TABS.map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-10">
          {tab === active ? (
            <div
              aria-busy={isPending || undefined}
              className={cn('motion-safe:transition-opacity', isPending && 'opacity-60')}
            >
              {children}
            </div>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
};

MediaTabs.displayName = 'MediaTabs';
export default MediaTabs;
