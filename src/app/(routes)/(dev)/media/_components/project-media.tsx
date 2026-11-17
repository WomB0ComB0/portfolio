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
 * @file A project page's "See also": the videos and posts about the project ("Video: <title>",
 * "Post: <title>"), each a link to the piece itself in a new tab, then one plain link to /media.
 * It is the other end of a /media row's "Project: <title>" link, from the same rules
 * (load-project-media.ts), so the two pages point at each other. Nothing renders for a project
 * with no media. Server-safe: no directive, no hooks.
 *
 * The project page renders it as the last of the project's own sections, above "Back to All
 * Projects", so it takes that column's width and section gap. Palette tokens only.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import type { ProjectMediaItem } from '../_lib/load-project-media';
import { KIND_WORDS } from '../_lib/media-feed';

export const PROJECT_MEDIA_TITLE = 'See also';
export const PROJECT_MEDIA_ALL = 'All writing and video';

const TITLE_ID = 'project-media-title';

const BLOCK_CLASS = 'flex flex-col gap-3 border-t border-hairline pt-6';
const HEADING_CLASS = 'tile-label text-faint';
const LIST_CLASS = 'flex flex-col gap-1';
/**
 * A link that looks like one: brand ink, a 24px target however short its words. It holds one
 * box (LINK_RUN_CLASS), centred in it, so a link that wraps is as tall as its lines.
 */
const LINK_CLASS =
  'group/ref inline-flex min-h-6 max-w-full items-center rounded-sm tile-sub text-brand-ink no-underline';
/**
 * The link's words and its new-tab arrow, as one run of text: the arrow is glued to the last
 * word (the kit's word joiner), so on a link that wraps it ends the last line instead of
 * floating beside all of them.
 */
const LINK_RUN_CLASS = 'min-w-0 wrap-break-word';
/** The words: a thin underline in the brand rim that turns full ink when pointed at or focused. */
const LINK_WORDS_CLASS =
  'underline decoration-(--brand-rim) decoration-1 underline-offset-4 transition-[text-decoration-color] duration-(--motion-fast) ease-effect group-hover/ref:decoration-current group-focus-visible/ref:decoration-current';
const ALL_CLASS =
  'inline-flex min-h-6 items-center rounded-sm tile-meta text-muted-foreground underline decoration-(--hairline-strong) decoration-1 underline-offset-4 transition-colors duration-(--motion-fast) ease-effect hover:text-foreground';

export interface ProjectMediaProps {
  /** The items about the project, newest first; none renders nothing. */
  readonly items: readonly ProjectMediaItem[];
}

/** "Video: <title>", "Post: <title>": each item of the project, then the way to all of /media. */
export function ProjectMedia({ items }: ProjectMediaProps): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <aside data-project-media="" aria-labelledby={TITLE_ID} className={BLOCK_CLASS}>
      <h2 id={TITLE_ID} className={HEADING_CLASS}>
        {PROJECT_MEDIA_TITLE}
      </h2>
      <ul className={LIST_CLASS}>
        {items.map((item) => (
          <li key={item.id} className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              data-project-media-item={item.kind}
              className={LINK_CLASS}
            >
              <span className={LINK_RUN_CLASS}>
                <span className={LINK_WORDS_CLASS}>
                  {KIND_WORDS[item.kind].one}: {item.title}
                </span>
                <NewTabArrow />
              </span>
              <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
            </a>
            {item.kind !== 'video' && item.kind !== 'stream' && (
              <LinkHealthBadge href={item.href} scope="media" />
            )}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/media" prefetch={false} data-project-media-all="" className={ALL_CLASS}>
          {PROJECT_MEDIA_ALL}
        </Link>
      </p>
    </aside>
  );
}
