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
 * @file ChapterJumps: the 'In this issue' row, a plain list of #anchor links to each chapter with
 * its count. Server-rendered and keyboard friendly: real links in tab order, each at least 36px
 * tall under a mouse and 44px under a finger (the site's touch target), wrapping onto a second
 * line on a phone rather than scrolling sideways (the Folio mock hid 2024 and 2023 off-screen).
 * Server-safe (no directive, no hooks).
 *
 * Hover and focus reach the same end state: the label brightens and an underline grows from the
 * left (transform on the house spring, so a quick pass reverses mid-way); focus adds the ring.
 * The underline is ::before: on this site an absolute ::after is a link's stretched hit area,
 * and the tap-target checks read it that way.
 */

import type { ReactElement } from 'react';

import type { Noun } from '@/lib/filters/types';
import { cn } from '@/lib/utils';
import { type ChapterJump, chapterJumps } from './chapter';

const NAV_CLASS = 'flex flex-wrap items-center gap-x-2 gap-y-1';
const LABEL_CLASS = 'tile-label text-faint';
const LIST_CLASS = 'flex flex-wrap items-center gap-x-0.5 gap-y-0.5';
const LINK_CLASS = [
  'group/jump relative inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 pointer-coarse:min-h-11',
  'tile-label text-muted-foreground transition-[scale] duration-(--motion-spring-out) ease-spring',
  'hover:text-foreground focus-visible:text-foreground active:scale-[0.97] active:duration-(--motion-instant) motion-reduce:active:scale-100',
  'before:pointer-events-none before:absolute before:inset-x-2 before:bottom-2 before:h-px before:origin-left before:scale-x-0 before:bg-current before:opacity-60 before:content-[""] pointer-coarse:before:bottom-3',
  'before:transition-transform before:duration-(--motion-spring-out) before:ease-spring',
  'hover:before:scale-x-100 hover:before:duration-(--motion-spring-in) focus-visible:before:scale-x-100 focus-visible:before:transition-none',
].join(' ');
const COUNT_CLASS =
  'tile-meta text-faint transition-colors duration-(--motion-fast) group-hover/jump:text-muted-foreground';

export interface ChapterJumpsProps {
  /** The chapters in page order; one with a count of 0 is left out. */
  readonly chapters: readonly ChapterJump[];
  /** The row's name, shown and announced; 'In this issue' by default. */
  readonly label?: string;
  /** What the counts count, so a screen reader hears '2026, 7 projects' rather than '2026, 7'. */
  readonly noun?: Noun;
  readonly className?: string;
}

/**
 * Jump links to a page's chapters. Draws nothing with fewer than two chapters to jump between.
 *
 * @example
 * <ChapterJumps
 *   noun={{ one: 'project', many: 'projects' }}
 *   chapters={[{ id: 'featured', label: 'Featured', count: 6 }, { id: 'y2026', label: '2026', count: 7 }]}
 * />
 */
export function ChapterJumps({
  chapters,
  label = 'In this issue',
  noun,
  className,
}: ChapterJumpsProps): ReactElement | null {
  const links = chapterJumps(chapters, noun);
  if (links.length < 2) return null;
  return (
    <nav aria-label={label} data-chapter-jumps="" className={cn(NAV_CLASS, className)}>
      <span aria-hidden="true" className={LABEL_CLASS}>
        {label}
      </span>
      <ol className={LIST_CLASS}>
        {links.map((link) => (
          <li key={link.id}>
            <a href={link.href} className={LINK_CLASS}>
              {link.label}
              {link.count === undefined ? null : (
                <>
                  <span className="sr-only">, {link.spoken}</span>
                  <span aria-hidden="true" className={COUNT_CLASS}>
                    {link.count}
                  </span>
                </>
              )}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
