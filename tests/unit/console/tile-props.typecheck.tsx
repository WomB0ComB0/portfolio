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
 * @file Compile-time checks of the Tile and StatTile prop unions, run by `tsc --noEmit -p .`
 * (tsconfig includes every .tsx; Vitest runs only *.test.tsx, so it never loads this file).
 *
 * Only `variant="interactive"` takes link props. Each `@ts-expect-error` below fails the type
 * check if the element under it compiles, so a reopened union shows up as a tsc error.
 */

import type { ReactElement } from 'react';

import { StatTile } from '@/components/console/stat-tile';
import { Tile } from '@/components/console/tile';

declare const plainOrLink: 'plain' | 'interactive';

/** Elements that must not compile: link props on a tile that is not a link. */
export const rejected: ReactElement[] = [
  // @ts-expect-error variant left out (plain): no href
  <Tile key="href" href="/projects" />,
  // @ts-expect-error variant left out (plain): no external
  <Tile key="external" external />,
  // @ts-expect-error variant left out (plain): no prefetch
  <Tile key="prefetch" prefetch />,
  // @ts-expect-error a linked tile holds a TileLink; it is not a link itself
  <Tile key="linked" variant="linked" href="/projects" />,
  // @ts-expect-error a variant that may be plain cannot take an href
  <Tile key="union" variant={plainOrLink} href="/projects" />,
  // @ts-expect-error an interactive tile needs its href
  <Tile key="no-href" variant="interactive" />,
  // @ts-expect-error a stat tile without variant="interactive" takes no href
  <StatTile key="stat-href" label="Typing" value={142} href="/stats" />,
  // @ts-expect-error nor external
  <StatTile key="stat-external" label="Typing" value={142} external />,
  // @ts-expect-error an interactive stat tile is one link, so it takes no action
  <StatTile key="stat-action" label="x" variant="interactive" href="/x" action={<b>retry</b>} />,
];

/** The same props in the places they belong compile. */
export const accepted: ReactElement[] = [
  <Tile key="interactive" variant="interactive" href="/projects" external prefetch />,
  <Tile key="plain" as="li" padding="none" />,
  <Tile key="linked" variant="linked" as="article" />,
  <StatTile key="stat-link" label="Typing" value={142} variant="interactive" href="/stats" />,
  <StatTile key="stat-linked" label="Typing" value={142} variant="linked" />,
  <StatTile key="stat-action" label="LeetCode" state="error" action={<b>retry</b>} />,
];
