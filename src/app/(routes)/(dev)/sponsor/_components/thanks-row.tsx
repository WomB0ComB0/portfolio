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
 * @file The /sponsor thank-you column: a quiet "Thank you" label (the same outside label the ways
 * column has, so the two columns' first boxes line up), then the people who sponsor or have
 * sponsored, as avatar circles beside their names (each name a link to their profile, in a new
 * tab), current sponsors marked "now". When the names have no room beside the circles they wrap
 * under them. With nobody yet, or with GitHub unavailable, it is the kit's one quiet EmptyState;
 * the error's retry is a plain link, so it works without JS. Server-safe: no directive, no hooks.
 */

import type { ReactElement } from 'react';

import { EmptyState, NEW_TAB_LABEL, NewTabArrow, SrOnlyWords, Tile } from '@/components/console';
import type { GitHubSponsorsData } from '@/lib/api-integrations/github-sponsors';
import { cn } from '@/lib/utils';
import { type ThanksPerson, thanksLine, thanksOf } from '../_lib/thanks';
import { anchorAttrs, linkTargetOf } from '../_lib/ways';
import { AvatarCircles } from './avatar-circles';
import { NAME_LINK_CLASS, NAME_UNDERLINE_CLASS, SECTION_LABEL_CLASS } from './sponsor-classes';

const THANKS_HEADING_ID = 'sponsor-thanks-heading';

/**
 * The circles and the names share a row while the names keep a readable width (NAMES_CLASS's
 * basis); with more circles or a narrower tile the names wrap under the stack instead of being
 * squeezed into a sliver beside it.
 */
const PEOPLE_ROW_CLASS = 'flex flex-wrap items-center gap-x-4 gap-y-3';

/** The names: at least 12rem beside the circles, else a line of their own (shrinking if narrower). */
const NAMES_CLASS = 'flex min-w-0 grow basis-48 flex-wrap gap-x-4 gap-y-1 tile-sub';

/**
 * One person: the name, then "now" for a current sponsor. Nothing in the item may wrap but the
 * name's own words (NAME_WORDS_CLASS), so the name's last word, its new-tab arrow and "now" move
 * to the next line together: "now" never sits on a line of its own, and stays right after the name.
 */
const PERSON_CLASS = 'min-w-0 whitespace-nowrap';
/** The name's words wrap as usual; a word longer than its line breaks as a last resort. */
const NAME_WORDS_CLASS = 'whitespace-normal [overflow-wrap:anywhere]';

/**
 * A person's name: a link to their profile, or plain text when GitHub gave no usable URL. Only the
 * name is underlined (its own span), so the arrow and the link's spoken words never carry it.
 */
function PersonName({ person }: { readonly person: ThanksPerson }): ReactElement {
  const target = linkTargetOf(person.url);
  if (target === null) {
    return (
      <span data-person-name="" className={cn('font-medium text-foreground', NAME_WORDS_CLASS)}>
        {person.name}
      </span>
    );
  }
  return (
    <a {...anchorAttrs(target)} className={NAME_LINK_CLASS}>
      <span data-person-name="" className={cn(NAME_UNDERLINE_CLASS, NAME_WORDS_CLASS)}>
        {person.name}
      </span>
      {target.newTab ? (
        <>
          <NewTabArrow />
          <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
        </>
      ) : null}
    </a>
  );
}

interface PeopleProps {
  readonly people: readonly ThanksPerson[];
  readonly currentCount: number;
}

/** The thank-you tile: its line, then the circles beside (or above) the names. */
function People({ people, currentCount }: PeopleProps): ReactElement {
  return (
    <Tile data-sponsor-thanks="" className="gap-4">
      <p className="tile-sub text-muted-foreground">{thanksLine(currentCount)}</p>
      <div className={PEOPLE_ROW_CLASS}>
        <AvatarCircles people={people} />
        <ul className={NAMES_CLASS}>
          {people.map((person) => (
            <li key={person.key} className={PERSON_CLASS}>
              <PersonName person={person} />
              {person.isCurrent ? <span className="ml-1.5 tile-meta text-faint">now</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </Tile>
  );
}

export interface ThanksRowProps {
  /** What GitHub returned, or null when it failed or missed the deadline. */
  readonly sponsors: GitHubSponsorsData | null;
  /** Where "Try again" leads after a failure: the page itself, reloaded. */
  readonly retryHref: string;
}

/** The people to thank, or one worded line when there is nobody (yet) or GitHub is down. */
function ThanksBody({ sponsors, retryHref }: ThanksRowProps): ReactElement {
  const thanks = thanksOf(sponsors);
  if (thanks.state === 'unavailable') {
    return (
      <EmptyState
        title="Couldn't load sponsors"
        level={3}
        action={{ href: retryHref, label: 'Try again' }}
      >
        GitHub didn't answer in time. The ways to sponsor still work.
      </EmptyState>
    );
  }
  if (thanks.state === 'none') {
    return (
      <EmptyState title="No sponsors yet" level={3}>
        The first one is thanked here, by name.
      </EmptyState>
    );
  }
  return <People people={thanks.people} currentCount={thanks.currentCount} />;
}

/** The thank-you column: its label, then the people, the empty state or the error under it. */
export function ThanksRow(props: ThanksRowProps): ReactElement {
  return (
    <section
      aria-labelledby={THANKS_HEADING_ID}
      data-sponsor-thanks-section=""
      className="flex flex-col gap-3"
    >
      <h2 id={THANKS_HEADING_ID} className={SECTION_LABEL_CLASS}>
        Thank you
      </h2>
      <ThanksBody {...props} />
    </section>
  );
}
