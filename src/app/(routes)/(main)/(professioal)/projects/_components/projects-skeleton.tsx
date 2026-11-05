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
 * @file The /projects frame (page width and header) and its loading skeleton. The skeleton uses
 * the frame, the filter bar's box and the card grid's real classes and sizes, so the loaded page
 * replaces it without moving anything. No hooks or client code: it renders on the server.
 */

import { Code } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { PageHeader } from '@/components/custom/page-header';
import { PROJECT_GRID_CLASS } from './project-card';

/** How many placeholder cards the skeleton shows: two rows on a wide screen. */
const SKELETON_CARD_COUNT = 6;

/** How many technology pills a placeholder card shows, as many as a real card names. */
const SKELETON_TECH_COUNT = 3;

const PULSE = 'bg-muted/20 animate-pulse';

/** The page's width and padding and its header, shared by the list and its skeleton. */
export function ProjectsPageFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-7xl space-y-16">
      <PageHeader
        title="My Projects"
        description="A showcase of my work spanning web development, mobile apps, and machine learning"
        icon={<Code />}
      />
      {children}
    </div>
  );
}

/** The filter bar's box: a search field and two menus, as tall as the real ones. */
const FilterBarSkeleton = (): JSX.Element => (
  <div className="sticky top-24 z-30 -mx-4 px-4 md:mx-0 md:px-0">
    <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-lg shadow-black/5">
      <div className="flex flex-col lg:flex-row gap-2">
        <div className={`flex-1 h-10 rounded-xl ${PULSE}`} />
        <div className="h-px lg:h-10 lg:w-px bg-white/10 mx-2" />
        <div className={`w-full lg:w-[200px] h-10 rounded-xl ${PULSE}`} />
        <div className={`w-full lg:w-[200px] h-10 rounded-xl ${PULSE}`} />
      </div>
    </div>
  </div>
);

/** One card's boxes: each text placeholder is one line of the real text's size. */
const ProjectCardSkeleton = (): JSX.Element => (
  <div className="h-full w-full">
    <div className="relative flex size-full flex-col overflow-hidden rounded-3xl border border-white/5 bg-card/40 backdrop-blur-md">
      <div className={`relative w-full aspect-video ${PULSE}`} />
      <div className="p-6 flex flex-col grow">
        <div className="space-y-3 mb-4">
          <div className="text-xl">
            <div className={`h-[1lh] w-3/4 rounded ${PULSE}`} />
          </div>
          <div className="text-sm leading-relaxed">
            <div className={`h-[1lh] w-full rounded ${PULSE}`} />
            <div className={`h-[1lh] w-5/6 rounded ${PULSE}`} />
          </div>
        </div>
        <div className="mt-auto space-y-6">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: SKELETON_TECH_COUNT }, (_, i) => (
              <span
                key={`tech-${+i}`}
                className={`px-2 py-0.5 text-[10px] rounded-md border border-transparent ${PULSE}`}
              >
                <span className="block h-[1lh] w-10" />
              </span>
            ))}
          </div>
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm">
              <div className={`h-[1lh] w-24 rounded ${PULSE}`} />
            </div>
            <div className={`w-8 h-8 rounded-full ${PULSE}`} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/** The /projects loading view: the real header, the filter bar's box and a grid of cards. */
export function ProjectsListSkeleton(): JSX.Element {
  return (
    <ProjectsPageFrame>
      <div role="status" aria-label="Loading projects" className="space-y-16">
        <FilterBarSkeleton />
        <div className={PROJECT_GRID_CLASS}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
            <ProjectCardSkeleton key={`project-skeleton-${+i}`} />
          ))}
        </div>
      </div>
    </ProjectsPageFrame>
  );
}
