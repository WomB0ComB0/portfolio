import 'server-only';

/**
 * Copyright 2026 Mike Odnis
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
 * @file /experience as a story (the owner's pick, 2026-11-15: "for experience i'd pick story"):
 * the PageShell header with one sentence written from the figures, then "The path so far"
 * (every role as a capsule on one month axis, role-path.tsx). A "Jump to" row leads to Now
 * and every year a role began, each role hung off one rail (role-chapter.tsx, role-stop.tsx).
 * The timeline opens the story; the current-role cards follow the overview and jump links.
 *
 * Rendered on the server with no loading.tsx above it, so every role, sentence, duty and link
 * is in the first HTML and reads without JavaScript. The one client part is the cross-lighting
 * island (role-crosslight.tsx): pointing at a role lights its capsule on the path, and it keeps
 * the list's history entries whole for the way back from a role page (role-jumps.ts). Logo URLs
 * are built here (role-logo.ts), so no client code loads the Sanity client. The day is passed in
 * by the page (nyToday()). A failed load is not caught here: it reaches the route's error view.
 */

import type { ReactElement } from 'react';

import { EmptyState, PageShell } from '@/components/console';
import { ChapterJumps } from '@/components/console/folio';
import type { Experience } from '@/hooks/sanity/schemas';
import { RoleCrosslight } from '../../_components/role-crosslight';
import { axisStyle } from '../../_components/role-lane';
import { ROLE_NOUN, RoleChapter } from '../../_components/story/role-chapter';
import { RolePathFigure } from '../../_components/story/role-path';
import { roleLogoOf } from '../../_lib/role-logo';
import { buildRoleStory, type RoleStory as Story, storyLede } from '../../_lib/role-story';

const STORY_TITLE = 'Experience';
const STORY_EYEBROW = 'Work';
const JUMP_LABEL = 'Jump to';
const EMPTY_TITLE = 'No roles listed yet';

/** The chapters follow the jump row after a long rest; the first one sets no gap of its own. */
const CHAPTERS_CLASS = 'mt-[clamp(2.5rem,1.75rem+2.5vw,4.5rem)] flex min-w-0 flex-col';

/** The role cards: Now when a role runs now, then the years. */
function StoryChapters({ story }: { readonly story: Story }): ReactElement {
  const [first, ...rest] = story.chapters;
  const chapter = (item: Story['chapters'][number], place: number): ReactElement => (
    <RoleChapter
      key={item.id}
      chapter={item}
      className={place === 0 && item.size === 'inline' ? 'mt-0' : undefined}
    />
  );
  return (
    <div className={CHAPTERS_CLASS}>
      {first ? chapter(first, 0) : null}
      {rest.map((item, index) => chapter(item, index + 1))}
    </div>
  );
}

export interface RoleStoryProps {
  readonly experiences: readonly Experience[];
  /** The day the page is rendered for, YYYY-MM-DD (the page's nyToday()). */
  readonly today: string;
  /** Pads the sides with the page gutter; the lab, already padded, turns it off. */
  readonly gutter?: boolean;
}

/** The timeline overview, chapter links, then Now and each year a role began. */
export function RoleStory({ experiences, today, gutter = true }: RoleStoryProps): ReactElement {
  const story = buildRoleStory(experiences, { today, logoOf: roleLogoOf });
  // Now's link has no count: the opening sentence says how many roles run now, once.
  const jumps = story.chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.title,
    count: chapter.kind === 'now' ? undefined : chapter.stops.length,
  }));

  return (
    <PageShell
      eyebrow={STORY_EYEBROW}
      title={STORY_TITLE}
      description={storyLede(story) || undefined}
      gutter={gutter}
    >
      {story.total === 0 ? (
        <EmptyState title={EMPTY_TITLE} />
      ) : (
        <div
          data-role-clock=""
          data-role-story=""
          className="flex min-w-0 flex-col"
          style={axisStyle(story.axis)}
        >
          <RolePathFigure
            path={story.path}
            axis={story.axis}
            peak={story.clock.peak}
            className="mt-0 mb-6"
          />
          <ChapterJumps chapters={jumps} label={JUMP_LABEL} noun={ROLE_NOUN} />
          <StoryChapters story={story} />
          <RoleCrosslight />
        </div>
      )}
    </PageShell>
  );
}
RoleStory.displayName = 'RoleStory';
