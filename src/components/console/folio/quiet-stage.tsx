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
 * @file QuietStage: the project page's backdrop for its header and media, in place of the washed
 * blur. Pure CSS (globals.css quiet-stage): surface-1 fading to the canvas, the violet spotlight
 * and a little brand light from above, and fine grain. No copy of the cover, no motion, nothing to
 * load. Server-safe (no directive, no hooks).
 *
 * The light fades out at the bottom instead of ending on a hairline, so no seam runs behind the
 * cover. `hang` leaves the stage's lower part unlit, so a cover placed at the bottom of the stage
 * hangs onto the canvas like a print. Forced colours turn the light off.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A length the stage's bottom stays unlit: '0', '34%', '6rem', '120px'. */
export type StageHang = '0' | `${number}${'%' | 'rem' | 'px'}`;

export interface QuietStageProps {
  /** The stage's element: a div by default, a header for a page's head. */
  readonly as?: 'div' | 'header' | 'section';
  /** How much of the stage's bottom stays unlit; none by default. */
  readonly hang?: StageHang;
  /** For a section: the heading that names it. */
  readonly 'aria-labelledby'?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

const HANG = /^(?:0|\d+(?:\.\d+)?(?:%|rem|px))$/u;

/**
 * A quiet, lit backdrop for a page's header and media.
 *
 * @example
 * <QuietStage as="header" hang="34%">
 *   <ProjectHead project={project} />
 *   <Cover image={project.cover} />
 * </QuietStage>
 */
export function QuietStage({
  as: Element = 'div',
  hang,
  'aria-labelledby': labelledBy,
  className,
  children,
}: QuietStageProps): ReactElement {
  const style =
    hang !== undefined && HANG.test(hang)
      ? ({ '--quiet-stage-hang': hang } as CSSProperties)
      : undefined;
  return (
    <Element
      data-quiet-stage=""
      aria-labelledby={labelledBy}
      className={cn('quiet-stage', className)}
      style={style}
    >
      {children}
    </Element>
  );
}
