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
 * @file TypeCover: the designed cover of a project with no image, where an empty grey box would
 * look broken. The project's name in at most two words is set large on a quiet surface
 * (surface-2, a brand wash from the lower left, fine grain), with the rest of its short name on a
 * quiet line under it: 'Brain Tumor' over 'Segmentation & Classification', 'Data Pipeline' over
 * 'Enterprise' and 'Web Scraper' over 'Enterprise AI Recursive', so a cover names its project at
 * a glance and no two look alike (type-cover-words.ts). Server-safe (no directive, no hooks).
 *
 * It is decorative (aria-hidden): the project's title is always in the heading beside it. It
 * takes its box from an aspect ratio, or fills a positioned frame (as next/image `fill` does),
 * and its words follow the box (globals.css type-cover*), so the same cover works as a lead plate
 * and as a brief's thumbnail. The name never breaks or clips: one line, no shift, line height 1,
 * and a size capped by the box's width over the name. The quiet line is sized to fit two lines,
 * so it is never cut by an ellipsis, and is readable or not there: at least 10px, and left out of
 * a cover under 100px wide (a phone's 88px row cover shows the name alone).
 */

import type { CSSProperties, ReactElement } from 'react';

import { cn } from '@/lib/utils';
import { type CoverRatio, coverRatio, typeCoverWords } from './type-cover-words';

const ROOT_CLASS = 'type-cover w-full';
const FILL_CLASS = 'absolute inset-0 h-full';
const FACE_CLASS = 'type-cover-face';
const LEAD_CLASS = 'type-cover-lead text-muted-foreground';
const REST_CLASS = 'type-cover-rest text-faint';

export interface TypeCoverProps {
  /** The project's title; the cover names it from its short name (before a dash, colon or bracket). */
  readonly title: string;
  /**
   * The other titles on the page: a name another project prefers gives way to a fallback.
   * Fallbacks can coincide; the full title remains outside this decorative cover. Optional.
   */
  readonly others?: readonly string[];
  /** The box's aspect ratio, as the image it stands in for: 16/10 by default. Ignored with fill. */
  readonly ratio?: CoverRatio;
  /** Fill a positioned parent instead of taking a ratio. */
  readonly fill?: boolean;
  readonly className?: string;
}

/**
 * A type-led cover for a project without an image.
 *
 * @example
 * <span className="relative block aspect-video overflow-hidden rounded-md">
 *   {image ? <Image fill ... /> : <TypeCover title={project.title} fill />}
 * </span>
 */
export function TypeCover({
  title,
  others,
  ratio,
  fill = false,
  className,
}: TypeCoverProps): ReactElement {
  const { lead, rest, units, restUnits } = typeCoverWords(title, others);
  const style = {
    '--folio-fit': String(units),
    '--folio-rest-fit': String(restUnits),
    ...(fill ? {} : { aspectRatio: coverRatio(ratio) }),
  } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-type-cover=""
      className={cn(ROOT_CLASS, fill && FILL_CLASS, className)}
      style={style}
    >
      <span className={FACE_CLASS}>
        <span className={LEAD_CLASS}>{lead}</span>
        {rest === '' ? null : <span className={REST_CLASS}>{rest}</span>}
      </span>
    </span>
  );
}
