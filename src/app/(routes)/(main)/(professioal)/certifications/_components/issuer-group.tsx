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
 * @file A busy year's issuer groups: the issuer's name large (the year's biggest larger still)
 * with a byline for its count and the platform its links lead to, then its certificates stacked
 * by month, each month once in the margin. Each title is its credential's link, in a new tab
 * (its arrow shows with the hover or focus); its margin says only what the group does not
 * (another issuer string, another platform, a stored file, no public link), then up to three of
 * its skills. Server-safe (no directive, no hooks); Copy ID is the one client part.
 */

import type { CSSProperties, ReactElement } from 'react';

import { Byline, countOf, widestWordUnits } from '@/components/console/folio';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import { CERTIFICATION_NOUN } from '../_lib/certification-filters';
import {
  briefNotes,
  type IssuerGroup,
  type MonthStack,
  ownPlatform,
  platformLine,
  type RecordEntry,
} from '../_lib/record';
import { skillsLine } from '../_lib/skills';
import { CredentialCopy, type CredentialEntry } from './credential';
import {
  BRIEF_ITEM_CLASS,
  BRIEF_LINE_CLASS,
  BRIEF_LINE_FULL_CLASS,
  BRIEF_LINK_CLASS,
  BRIEF_MARGIN_CLASS,
  BRIEF_TEXT_CLASS,
  COPY_SLOT_CLASS,
  GROUP_BYLINE_CLASS,
  GROUP_CLASS,
  GROUP_HEAD_CLASS,
  GROUP_NAME_CLASS,
  GROUPS_CLASS,
  MARGIN_JOIN_CLASS,
  MARGIN_NOTE_CLASS,
  MARGIN_TEXT_CLASS,
  MONTH_CLASS,
  STACK_CLASS,
  STACK_ITEMS_CLASS,
  STACKS_CLASS,
} from './record-classes';
import { SkillsLine } from './skills-line';

/** The dot between a note and the skills run on after it, glued to the note by a no-break space. */
const MARGIN_JOIN = ' ·';

/** What a certificate in a group shows. */
export type BriefEntry = CredentialEntry & RecordEntry;

type Group = IssuerGroup<BriefEntry>;

interface BriefProps {
  readonly entry: BriefEntry;
  readonly group: Group;
}

/**
 * The title as the credential's link. When the group's line already names the platform, screen
 * readers hear it in the link too ('Java, verify on Sololearn'); a stored file's note says what
 * it is under the title, so its link claims no platform.
 */
function BriefTitle({ entry, group }: BriefProps): ReactElement {
  if (!entry.link) {
    return (
      <span data-cert-title="" className={BRIEF_TEXT_CLASS}>
        {entry.title}
      </span>
    );
  }
  const named = entry.link.verifies && ownPlatform(entry, group.platform) === null;
  return (
    <a
      href={entry.link.href}
      target="_blank"
      rel="noopener noreferrer"
      data-cert-title=""
      data-cert-file={entry.link.verifies ? undefined : ''}
      className={BRIEF_LINK_CLASS}
    >
      {entry.title}
      {named ? <span className="sr-only">, verify on {entry.link.platform}</span> : null}
      <NewTabArrow />
      <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
    </a>
  );
}

/**
 * A certificate's margin: what its group does not say, then its skills. Under the title they are
 * two lines; in the wide margin column they run on as one, joined by a dot glued to the note (a
 * no-break space before it, the line's break after it), so the dot never starts a line.
 */
function BriefMargin({
  notes,
  skills,
}: {
  readonly notes: readonly string[];
  readonly skills: readonly string[];
}): ReactElement {
  const both = notes.length > 0 && skillsLine(skills).shown.length > 0;
  return (
    <div data-cert-margin="" className={BRIEF_MARGIN_CLASS}>
      <Byline parts={notes} className={MARGIN_NOTE_CLASS} />
      {both ? (
        <>
          <span aria-hidden="true" className={MARGIN_JOIN_CLASS}>
            {MARGIN_JOIN}
          </span>{' '}
        </>
      ) : null}
      <SkillsLine skills={skills} className={MARGIN_TEXT_CLASS} />
    </div>
  );
}

/**
 * One certificate in a group: its title line, then the margin (what the group does not say, then
 * its skills), under the title on a phone and in a column of its own on a wide page.
 */
function BriefCredential({ entry, group }: BriefProps): ReactElement {
  const notes = briefNotes(entry, group);
  const margin = notes.length > 0 || skillsLine(entry.skills).shown.length > 0;
  return (
    <li data-cert-item="" data-cert-size="brief" className={BRIEF_ITEM_CLASS}>
      <span className={cn(BRIEF_LINE_CLASS, !margin && BRIEF_LINE_FULL_CLASS)}>
        <BriefTitle entry={entry} group={group} />
        {entry.credentialId ? (
          <span className={COPY_SLOT_CLASS}>
            <CredentialCopy entry={entry} />
          </span>
        ) : null}
      </span>
      {margin ? <BriefMargin notes={notes} skills={entry.skills} /> : null}
    </li>
  );
}

/** A month in the margin, then the certificates of that month. */
function Stack({
  stack,
  group,
}: {
  readonly stack: MonthStack<BriefEntry>;
  readonly group: Group;
}): ReactElement {
  return (
    <li data-month-stack="" className={STACK_CLASS}>
      <span className={MONTH_CLASS}>
        {stack.month ? (
          <time dateTime={stack.month.iso}>
            {stack.month.name}
            <span className="sr-only"> {stack.month.year}</span>
          </time>
        ) : null}
      </span>
      <ul className={STACK_ITEMS_CLASS}>
        {stack.entries.map((entry) => (
          <BriefCredential key={entry.id} entry={entry} group={group} />
        ))}
      </ul>
    </li>
  );
}

/**
 * One issuer's group: its name and byline, then its month stacks. A group whose count is already
 * said (by the year's sentence, 'Mostly Google: 16 of 26.', or by the jump link of a year it has
 * to itself) keeps only where its links lead.
 */
function IssuerGroupSection({
  group,
  headingId,
}: {
  readonly group: Group;
  readonly headingId: string;
}): ReactElement {
  const fit = { '--folio-fit': String(widestWordUnits(group.label)) } as CSSProperties;
  return (
    <section data-issuer-group={group.key} className={GROUP_CLASS}>
      <header className={GROUP_HEAD_CLASS}>
        <h3
          id={headingId}
          className={group.top ? GROUP_NAME_CLASS.top : GROUP_NAME_CLASS.rest}
          style={fit}
        >
          {group.label}
        </h3>
        <Byline
          parts={[
            !group.countSaid && countOf(group.count, CERTIFICATION_NOUN),
            platformLine(group.platform),
          ]}
          className={GROUP_BYLINE_CLASS}
        />
      </header>
      <ol aria-labelledby={headingId} className={STACKS_CLASS}>
        {group.stacks.map((stack) => (
          <Stack key={stack.key} stack={stack} group={group} />
        ))}
      </ol>
    </section>
  );
}

/** A busy year's issuer groups, biggest first, 'One each' last. */
export function IssuerGroups({
  groups,
  chapterId,
}: {
  readonly groups: readonly Group[];
  /** The year's section id, so each group's heading id is unique on the page. */
  readonly chapterId: string;
}): ReactElement {
  return (
    <div className={GROUPS_CLASS}>
      {groups.map((group) => (
        <IssuerGroupSection key={group.key} group={group} headingId={`${chapterId}-${group.key}`} />
      ))}
    </div>
  );
}
