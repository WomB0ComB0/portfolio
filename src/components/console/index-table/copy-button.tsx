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

'use client';

/**
 * @file A row's Copy action (Copy ID on /certifications): a small button above the stretched
 * title link that copies its value to the clipboard. Its label stays "ID" and its width never
 * changes (a check replaces the word for a moment, so nothing in the cell moves); the page's
 * polite line (IndexAnnouncer) says it was copied, or, where the clipboard is blocked, reads the
 * value out so it can be noted by hand. The value is also the button's tooltip.
 */

import { type ReactElement, type ReactNode, useEffect, useState } from 'react';

import { INDEX_COPY_CLASS } from './index-table-classes';

/** How long the check shows before the word comes back. */
const DONE_MS = 1600;

/** Says `text` in the page's polite line, if it has one. */
function announce(text: string): void {
  const line = document.querySelector<HTMLElement>('[data-index-announcer]');
  if (line) line.textContent = text;
}

function CheckIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
      <path
        d="m3.5 8.5 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface IndexCopyButtonProps {
  /** What is copied, and the tooltip. */
  readonly value: string;
  /** What the value is, after "Copy": "the credential ID for Agile Project Management". */
  readonly label: string;
  /** The visible word. */
  readonly children?: ReactNode;
}

/** Copies `value`, and says so. */
export function IndexCopyButton({
  value,
  label,
  children = 'ID',
}: IndexCopyButtonProps): ReactElement {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), DONE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      announce(`Copied ${label}`);
    } catch {
      // A blocked clipboard is no failure of the page: the value is read out instead.
      const said = label.charAt(0).toUpperCase() + label.slice(1);
      announce(`${said} is ${value}`);
    }
  };

  return (
    <button
      type="button"
      title={value}
      aria-label={`Copy ${label}`}
      data-done={done ? '' : undefined}
      className={INDEX_COPY_CLASS}
      onClick={() => void copy()}
    >
      {done ? <CheckIcon /> : children}
    </button>
  );
}
