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
 * @file The one empty state for data that isn't there (no posts yet, nothing playing, no sponsors
 * yet). It shares FilterBar.Empty's dashed box and type, so "nothing matched" and "nothing yet"
 * read alike everywhere. A server component: it renders in the HTML with no client code.
 */

import type { ReactElement, ReactNode } from 'react';

import {
  EMPTY_CLASS,
  EMPTY_CLEAR_CLASS,
  EMPTY_TEXT_CLASS,
  EMPTY_TITLE_CLASS,
} from './filter-bar/filter-bar-classes';

export interface EmptyStateAction {
  readonly href: string;
  readonly label: string;
}

export interface EmptyStateProps {
  /** What's missing, as a short sentence-case heading: "No talks yet". */
  readonly title: string;
  /** The heading level, so it fits the page outline; 2 by default. */
  readonly level?: 2 | 3 | 4;
  /** One sentence on why, or what to do instead. */
  readonly children?: ReactNode;
  /** One optional link onward. */
  readonly action?: EmptyStateAction;
}

/** A named, quiet empty state with an optional single link onward. */
export function EmptyState({ title, level = 2, children, action }: EmptyStateProps): ReactElement {
  const Heading = `h${level}` as const;
  return (
    <div data-state="empty" className={EMPTY_CLASS}>
      <Heading className={EMPTY_TITLE_CLASS}>{title}</Heading>
      {children ? <p className={EMPTY_TEXT_CLASS}>{children}</p> : null}
      {action ? (
        <a href={action.href} className={EMPTY_CLEAR_CLASS}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
