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
 * @file A certificate's skills as one quiet line: Geist at meta size, faint, sentence case as the
 * credential writes them, at most three and then '+5' for the rest ('CSS · Redux.js · Web
 * Development +5'). Screen readers hear 'Skills: CSS, Redux.js, Web Development and 5 more'.
 * Server-safe (no directive, no hooks).
 *
 * Each skill is kept whole on its line: the line wraps only between skills, never inside 'Web
 * Development', and the '+5' stays with the last skill. Only a skill wider than the whole line
 * (200% text in a 320px window) wraps inside itself, at its spaces.
 */

import { Fragment, type ReactElement } from 'react';

import { cn } from '@/lib/utils';
import { skillsLine } from '../_lib/skills';
import {
  SKILLS_CLASS,
  SKILLS_ITEM_CLASS,
  SKILLS_MORE_CLASS,
  SKILLS_SEPARATOR_CLASS,
} from './record-classes';

/**
 * A no-break space glues the dot to the skill before it, so a wrapped line never starts with one.
 * The space after it sits between the skills' own boxes, the one place the line may break, and
 * outside the hidden dot, so screen readers keep it.
 */
const SEPARATOR = ' ·';

export interface SkillsLineProps {
  readonly skills: readonly string[];
  readonly className?: string;
}

/** Glues '+5' to the last skill, so a wrapped line never starts with it. */
const MORE_GLUE = ' ';

/** What follows a skill inside its box: the dot and spoken comma, or the last one's '+5'. */
function SkillTail({
  last,
  more,
}: {
  readonly last: boolean;
  readonly more: number;
}): ReactElement | null {
  if (!last) {
    return (
      <>
        <span className="sr-only">,</span>
        <span aria-hidden="true" className={SKILLS_SEPARATOR_CLASS}>
          {SEPARATOR}
        </span>
      </>
    );
  }
  if (more === 0) return null;
  return (
    <>
      <span aria-hidden="true" className={SKILLS_MORE_CLASS}>
        {`${MORE_GLUE}+${more}`}
      </span>
      <span className="sr-only"> and {more} more</span>
    </>
  );
}

/** The skills a certificate lists, or nothing when it lists none. */
export function SkillsLine({ skills, className }: SkillsLineProps): ReactElement | null {
  const { shown, more } = skillsLine(skills);
  if (shown.length === 0) return null;
  return (
    <p data-cert-skills="" className={cn(SKILLS_CLASS, className)}>
      <span className="sr-only">Skills: </span>
      {shown.map((skill, index) => {
        const last = index === shown.length - 1;
        return (
          <Fragment key={skill}>
            <span className={SKILLS_ITEM_CLASS}>
              {skill}
              <SkillTail last={last} more={more} />
            </span>
            {last ? null : ' '}
          </Fragment>
        );
      })}
    </p>
  );
}
