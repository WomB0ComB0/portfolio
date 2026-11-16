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
 * @file Text that may wrap only where case-text.ts cut it: the parts in order with a <wbr>
 * between each two, server-rendered. Copied or read aloud, it is the text as Studio wrote it.
 * - Breakable: any parts (a live site's address, cut after each dot).
 * - Prose: Studio's prose. Each long address or path in it is one inline block that holds its
 *   cuts: it moves whole to the next line whenever it fits there, and wraps at its dots and
 *   slashes only when it is wider than the line (enlarged text on a phone), never at the edge of
 *   a line it would fit on whole ('links.' / 'mikeodnis.dev'). It takes its parent's underline,
 *   which an inline block would otherwise drop (a Built with link).
 */

import { Fragment, type ReactElement } from 'react';

import { proseRuns } from './case-text';

/** One long address or path: whole when it fits a line, never wider than its column. */
const WHOLE_CLASS = 'inline-block max-w-full [text-decoration:inherit]';

/** The parts with a <wbr> between each two. */
export function Breakable({ parts }: { readonly parts: readonly string[] }): ReactElement {
  return (
    <>
      {parts.map((part, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed text and may repeat ('a.a.com').
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Studio's prose, which may also wrap inside a long address or path that is wider than its line.
 * A run alone in its text is the whole line already, so it needs no block of its own.
 */
export function Prose({ text }: { readonly text: string }): ReactElement {
  const runs = proseRuns(text);
  const [only] = runs;
  if (runs.length === 1 && typeof only !== 'string' && only !== undefined) {
    return <Breakable parts={only} />;
  }
  return (
    <>
      {runs.map((run, index) =>
        typeof run === 'string' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs are fixed text and may repeat.
          <Fragment key={index}>{run}</Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs are fixed text and may repeat.
          <span key={index} className={WHOLE_CLASS}>
            <Breakable parts={run} />
          </span>
        ),
      )}
    </>
  );
}
