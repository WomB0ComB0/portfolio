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
 * @file One project's row in the /projects Index (style 2, the open index), rendered on the
 * server and handed to the filter island as markup. Server-safe (no directive, no hooks); the
 * title's next/link and its pending spinner are the client parts.
 *
 * On a wide page the row is five cells on one 64px line: the title (the row's one link,
 * stretched over the row, to the project page) over its summary; the first kind, as a word;
 * the first three technologies and how many more; the start month (the year bar holds the
 * year, so only the Featured group says it); and Code and Live, above the row's link, in a new
 * tab. On a phone the middle cells are hidden and the title carries one meta line instead:
 * "Kind · Mon". Kinds are told apart by words and position only, never by colour.
 */

import type { ReactElement } from 'react';

import {
  INDEX_ACTION_CLASS,
  INDEX_META_CLASS,
  INDEX_SUB_CLASS,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';
import { NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { LinkPending } from '@/components/data/link-pending';
import { cn } from '@/lib/utils';
import type { ProjectEntry } from '../_lib/project-index';
import { FEATURED_GROUP } from '../_lib/project-order';
import { projectHref } from '../_lib/project-text';
import {
  LINK_SLOT_CLASS,
  LINKS_CLASS,
  PROJECT_COLUMNS,
  TECH_LINE_CLASS,
  TECH_MORE_CLASS,
  TECH_NAMES_CLASS,
  TITLE_LINE_CLASS,
  TITLE_LINK_CLASS,
  TITLE_TEXT_CLASS,
} from './project-index-classes';

const [PROJECT, KIND, TECH, STARTED, LINKS] = PROJECT_COLUMNS;
/** Technologies named in the row; the rest are counted. */
const TECHS_SHOWN = 3;

interface RowProps {
  readonly entry: ProjectEntry;
}

/** The month, with its year in the Featured group (whose heading is no year). */
const monthText = (entry: ProjectEntry): string | null => {
  if (!entry.started) return null;
  return entry.group === FEATURED_GROUP
    ? `${entry.started.name} ${entry.started.year}`
    : entry.started.name;
};

/** Started: the month (the year said to screen readers too), or a dash for "No start date". */
function Started({ entry }: RowProps): ReactElement {
  const text = monthText(entry);
  if (!entry.started || text === null) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No start date</span>
      </>
    );
  }
  const yearSaid = entry.group !== FEATURED_GROUP;
  return (
    <time dateTime={entry.started.iso} className="tabular-nums">
      {text}
      {yearSaid && <span className="sr-only"> {entry.started.year}</span>}
    </time>
  );
}

/** The first three technologies, then a faint "+N" (screen readers hear the rest by name). */
function Technologies({ entry }: RowProps): ReactElement {
  const shown = entry.techLabels.slice(0, TECHS_SHOWN);
  const more = entry.techLabels.slice(TECHS_SHOWN);
  return (
    <span className={TECH_LINE_CLASS}>
      <span className={TECH_NAMES_CLASS}>{shown.join(' · ')}</span>
      {more.length > 0 && (
        <>
          <span aria-hidden="true" className={TECH_MORE_CLASS}>
            +{more.length}
          </span>
          <span className="sr-only">
            , and {more.length} more: {more.join(', ')}
          </span>
        </>
      )}
    </span>
  );
}

interface ActionProps {
  readonly href: string | null;
  readonly label: 'Code' | 'Live';
  readonly title: string;
}

/** Code or Live in a new tab, named for its project; an empty slot (hidden) when missing. */
function Action({ href, label, title }: ActionProps): ReactElement {
  if (!href) return <span aria-hidden="true" data-link-slot="" className={LINK_SLOT_CLASS} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-project-link={label.toLowerCase()}
      className={cn(INDEX_ACTION_CLASS, LINK_SLOT_CLASS)}
    >
      {label}
      <SrOnlyWords>
        for {title} {NEW_TAB_LABEL}
      </SrOnlyWords>
    </a>
  );
}

/** One project. */
export function ProjectRow({ entry }: RowProps): ReactElement {
  const month = monthText(entry);
  const kind = entry.kindLabels[0] ?? '';
  const phoneMeta = [kind, month].filter(Boolean).join(' · ');
  return (
    <IndexRow data-project-row="" data-preview-id={entry.id}>
      <td className={indexCellClass(PROJECT)}>
        <span className={TITLE_LINE_CLASS}>
          <IndexTitleLink
            href={projectHref(entry.id)}
            internal
            data-project-title=""
            className={TITLE_LINK_CLASS}
          >
            <span className={TITLE_TEXT_CLASS}>{entry.title}</span>
            <LinkPending />
          </IndexTitleLink>
        </span>
        <span className={INDEX_SUB_CLASS}>{entry.summary}</span>
        {phoneMeta && <span className={INDEX_META_CLASS}>{phoneMeta}</span>}
      </td>
      <td className={indexCellClass(KIND)}>{kind}</td>
      <td className={indexCellClass(TECH)}>
        <Technologies entry={entry} />
      </td>
      <td className={indexCellClass(STARTED)}>
        <Started entry={entry} />
      </td>
      <td className={indexCellClass(LINKS)}>
        <span className={LINKS_CLASS}>
          <Action href={entry.githubUrl} label="Code" title={entry.title} />
          <Action href={entry.liveUrl} label="Live" title={entry.title} />
        </span>
      </td>
    </IndexRow>
  );
}
