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
 * @file One year of the guestbook wall (WallChapter), with synthetic notes:
 * - its year is sized by the chapter system: a one-note year is a heading on the rule, a fuller
 *   first year the numeral, a fuller later year a step;
 * - the count sits in the year's own heading line, right after it;
 * - while the page is open the year keeps the size it opened with, so the refresh that lists a
 *   new post never grows it over the compose box; the next visit sizes it afresh;
 * - the empty and error states say their words on the rule instead of a count.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import { WallChapter } from '@/app/(routes)/(main)/(personal)/guestbook/_components/wall-chapter';
import type { ChapterPlan } from '@/app/(routes)/(main)/(personal)/guestbook/_lib/wall';
import type { GuestbookMessage } from '@/lib/guestbook/types';

const note = (id: string, text = 'A note'): GuestbookMessage => ({
  id,
  authorName: 'Jane Example',
  message: text,
  createdAt: '2026-11-01T09:00:00.000Z',
});

const PLAN: ChapterPlan = { key: 'newest', year: 2026, server: 0 };

/** The first year's chapter with these server notes, as the board draws it. */
const chapter = (notes: readonly GuestbookMessage[], index = 0) => (
  <WallChapter
    plan={PLAN}
    index={index}
    serverCount={notes.length}
    serverRows={notes.map((message) => <MessageRow key={message.id} message={message} />)}
    state={null}
    posted={[]}
    compose={index === 0 ? <p>Compose</p> : null}
  />
);

const section = () => screen.getByRole('region', { name: '2026' });

afterEach(cleanup);

describe('WallChapter', () => {
  it('sets a one-note year as a heading on the rule, a fuller first year as the numeral', () => {
    const { unmount } = render(chapter([note('a')]));
    expect(section()).toHaveAttribute('data-chapter', 'inline');
    unmount();

    render(chapter([note('a'), note('b')]));
    expect(section()).toHaveAttribute('data-chapter', 'lead');
  });

  it('steps a fuller later year down', () => {
    render(chapter([note('a'), note('b')], 1));

    expect(section()).toHaveAttribute('data-chapter', 'step');
  });

  it('puts the count right after the year, in the same heading line', () => {
    render(chapter([note('a'), note('b')]));
    const heading = screen.getByRole('heading', { level: 2, name: '2026' });

    expect(heading.nextElementSibling).toHaveTextContent('2 notes');
    expect(heading.nextElementSibling).toHaveAttribute('data-byline');
  });

  it('keeps the size it opened with through the refresh that lists a new post', () => {
    const { rerender, unmount } = render(chapter([note('a')]));

    rerender(chapter([note('new'), note('a')]));

    expect(section()).toHaveAttribute('data-chapter', 'inline');
    expect(section().querySelector('[data-byline]')).toHaveTextContent('2 notes');
    // The next visit sizes the fuller year afresh.
    unmount();
    render(chapter([note('new'), note('a')]));
    expect(section()).toHaveAttribute('data-chapter', 'lead');
  });

  it('says the empty state on the rule, with no count', () => {
    render(
      <WallChapter
        plan={{ key: 'newest', year: null, server: null }}
        index={0}
        serverCount={0}
        state={{ title: 'No messages yet', text: 'Be the first to sign the guestbook.' }}
        posted={[]}
        compose={<p>Compose</p>}
      />,
    );
    const region = screen.getByRole('region', { name: 'No messages yet' });

    expect(region).toHaveAttribute('data-chapter', 'inline');
    expect(region).toHaveTextContent('Be the first to sign the guestbook.');
    expect(region.querySelector('[data-byline]')).toBeNull();
  });
});
