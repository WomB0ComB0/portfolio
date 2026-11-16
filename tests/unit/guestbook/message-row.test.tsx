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
 * @file A guestbook row renders the message and its author as plain text: React escapes it once,
 * nothing escapes it again, so an apostrophe shows as one and markup shows as the characters
 * typed. The row never decodes entities: legacy author names are decoded once by the loader, so
 * text that a visitor typed as '&amp;' (a new post, or the row still being posted) shows as typed.
 * The row's meta line is the author, then the month (no time of day), the dot kept with the
 * month, so a wrapped signature moves the two together (and the page clips the dot there). A
 * note sits on the wall by its length (a sticker, a tile or a quote). A word holding an address
 * is one inline block that may wrap only after a dot or a slash, each piece's last character held
 * with the marks that close it; hostile notes still render as text in plain spans.
 */

import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  NOTE_ADDRESS_CLASS,
  NOTE_HELD_CLASS,
} from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook-classes';
import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import { stickerUnits } from '@/app/(routes)/(main)/(personal)/guestbook/_lib/wall';
import { widestWordUnits } from '@/components/console/folio';
import type { GuestbookMessage } from '@/lib/guestbook/types';

const DOT = '·';

const message = (overrides: Partial<GuestbookMessage> = {}): GuestbookMessage => ({
  id: 'm1',
  authorName: 'Jane Example',
  message: 'Hello there',
  createdAt: '2025-10-27T09:19:00.000Z',
  ...overrides,
});

const renderRow = (row: GuestbookMessage, pending?: boolean) =>
  render(
    <ol>
      <MessageRow message={row} pending={pending} />
    </ol>,
  ).container;

describe('MessageRow', () => {
  it('shows an apostrophe and an ampersand as typed, never as entities', () => {
    const root = renderRow(message({ message: "It's great & fun", authorName: "D'Angelo & Co" }));

    expect(root.textContent).toContain("It's great & fun");
    expect(root.textContent).toContain("D'Angelo & Co");
    expect(root.textContent).not.toMatch(/&(amp|lt|gt|quot|#0?39);/);
  });

  it("renders a '<script>' message as text, with no element made from it", () => {
    const root = renderRow(
      message({ message: '<script>alert(1)</script><img src=x onerror=alert(2)>' }),
    );

    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });

  it('shows text that looks like an entity exactly as typed, posted or still posting', () => {
    const typed = message({
      authorName: 'Tom &amp; Jerry',
      message: 'Write &amp; for an ampersand, use &lt;br&gt;',
    });

    for (const pending of [false, true]) {
      const root = renderRow(typed, pending);
      expect(root.textContent).toContain('Write &amp; for an ampersand, use &lt;br&gt;');
      expect(root.textContent).toContain('Tom &amp; Jerry');
      expect(root.querySelector('br')).toBeNull();
    }
  });

  it('escapes the text once in the server HTML', () => {
    const html = renderToString(<MessageRow message={message({ message: "It's <b>" })} />);

    expect(html).toContain('It&#x27;s &lt;b&gt;');
    expect(html).not.toContain('&amp;#');
  });

  it('puts the message first, then author · month, with the day in the time element', () => {
    const root = renderRow(message());
    const row = root.querySelector('li[data-message-row]');
    const time = row?.querySelector('time');

    expect(row?.firstElementChild?.textContent).toBe('Hello there');
    expect(row?.textContent).toMatch(/Jane Example\s*·\s*,?\s*Oct 2025$/);
    expect(time?.getAttribute('dateTime')).toBe('2025-10-27');
    expect(row?.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(row).toHaveAttribute('data-state', 'ready');
  });

  it('marks a row that is still being posted as loading and busy, without a date yet', () => {
    const root = renderRow(message(), true);
    const row = root.querySelector('li[data-message-row]');

    expect(row).toHaveAttribute('data-state', 'loading');
    expect(row).toHaveAttribute('aria-busy', 'true');
    expect(row?.textContent).toContain('Posting');
    expect(row?.querySelector('time')).toBeNull();
  });

  it('sets a few characters large and a sentence as body text, by length', () => {
    const scaleOf = (text: string) =>
      renderRow(message({ message: text }))
        .querySelector('li[data-message-row]')
        ?.getAttribute('data-scale');

    expect(scaleOf('goat')).toBe('word');
    expect(scaleOf('Nice Portfolio dude!')).toBe('line');
    expect(scaleOf('really trippy mouse cursor man')).toBe('note');
    expect(scaleOf('Love your work. Looking forward for a project collaboration with you!')).toBe(
      'body',
    );
  });

  it('keeps the line breaks a note was stored with', () => {
    const root = renderRow(message({ message: 'W port.\n\n-V' }));

    expect(root.querySelector('li[data-message-row] p')?.textContent).toBe('W port.\n\n-V');
  });

  it('keeps the dot with the month, after the one space a wrapped signature breaks at', () => {
    const root = renderRow(message());
    const signature = root.querySelector('li[data-message-row] > p:last-child');
    const month = signature?.querySelector('time')?.parentElement;
    const name = Array.from(signature?.querySelectorAll('span') ?? []).find(
      (span) => span.textContent === 'Jane Example',
    );

    // The one break opportunity is the plain space after the name, so the month wraps whole and
    // its dot with it (clipped off a line of its own: guestbook.spec.ts measures that).
    expect(name?.nextSibling?.textContent).toBe(' ');
    expect(name?.nextSibling?.nextSibling).toBe(month);
    // The dot is decoration: a screen reader hears 'Jane Example Oct 2025'.
    expect(month?.querySelector('[aria-hidden="true"]')?.textContent).toBe(DOT);
    expect(signature?.textContent).toBe(`Jane Example ${DOT}Oct 2025`);
    expect(month?.textContent).toBe(`${DOT}Oct 2025`);
  });

  it('keeps the dot with "Posting…" while a note is sent, and drops it with no date', () => {
    const posting = renderRow(message(), true).querySelector('li > p:last-child');
    const undated = renderRow(message({ createdAt: 'not a date' })).querySelector(
      'li > p:last-child',
    );

    expect(posting?.textContent).toBe(`Jane Example ${DOT}Posting…`);
    expect(undated?.textContent).toBe('Jane Example');
    expect(undated?.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('sits a note on the wall by its length: sticker, tile or quote', () => {
    const rowOf = (text: string) =>
      renderRow(message({ message: text })).querySelector('li[data-message-row]');
    const sticker = rowOf('goat');
    const tile = rowOf('really trippy mouse cursor man');
    const quote = rowOf('Love your work. Looking forward for a project collaboration with you!');

    expect(sticker).toHaveAttribute('data-treatment', 'sticker');
    expect(tile).toHaveAttribute('data-treatment', 'tile');
    expect(quote).toHaveAttribute('data-treatment', 'quote');
    // Only a quote has the hanging mark, hidden from screen readers and outside the note's text.
    expect(sticker?.querySelector(':scope > span[aria-hidden="true"]')).toBeNull();
    expect(tile?.querySelector(':scope > span[aria-hidden="true"]')).toBeNull();
    expect(quote?.querySelector(':scope > span[aria-hidden="true"]')?.textContent).toBe('“');
    expect(quote?.querySelector('p')?.textContent).toBe(
      'Love your work. Looking forward for a project collaboration with you!',
    );
  });

  it("gives a sticker its words' measures, so its width and size follow them", () => {
    const sticker = renderRow(message({ message: 'rawr xd' })).querySelector('li');
    const tile = renderRow(message({ message: 'really trippy mouse cursor man' })).querySelector(
      'li',
    );

    expect(sticker?.style.getPropertyValue('--note-fit')).toBe(String(widestWordUnits('rawr xd')));
    expect(sticker?.style.getPropertyValue('--note-units')).toBe(String(stickerUnits('rawr xd')));
    expect(tile?.style.getPropertyValue('--note-units')).toBe('');
  });

  it('keeps an address one inline block that wraps only after a dot or a slash', () => {
    const text = 'Just use my LinkTree (http://linktr.ee/mikeodnis) \n- Mike';
    const note = renderRow(message({ message: text })).querySelector('li p');
    // What sits between the break opportunities, as the note can wrap.
    if (!note) throw new Error('message row has no note');
    const pieces = [''];
    const walker = document.createTreeWalker(note, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeName === 'WBR') pieces.push('');
      else if (node.nodeType === Node.TEXT_NODE)
        pieces[pieces.length - 1] += node.textContent ?? '';
    }
    const words = Array.from(note?.children ?? []);

    expect(note?.textContent).toBe(text);
    expect(pieces).toEqual([
      'Just use my LinkTree (http://',
      'linktr.',
      'ee/',
      'mikeodnis) \n- Mike',
    ]);
    // The whole word, bracket included, is one block: it moves to the next line whole.
    expect(words.map((word) => [word.className, word.textContent])).toEqual([
      [NOTE_ADDRESS_CLASS, '(http://linktr.ee/mikeodnis)'],
    ]);
  });

  it("holds each piece's last character with the marks that close it, in one run", () => {
    const text = 'consider A11y (https://example.org/contrastchecker/) Good luck!';
    const note = renderRow(message({ message: text })).querySelector('li p');
    const held = Array.from(note?.querySelectorAll(`span.${NOTE_HELD_CLASS}`) ?? []);

    expect(note?.textContent).toBe(text);
    expect(held.map((span) => span.textContent)).toEqual(['e.', 'g/', 'r/)']);
    for (const span of held) expect(span.querySelector('wbr')).toBeNull();
    // A note with no address is plain text, with no runs at all.
    expect(renderRow(message({ message: 'goat' })).querySelector('li p')?.innerHTML).toBe('goat');
  });

  it.each([
    '<script>alert(1)</script> https://x.com/someone/status/1851234567890123456)',
    '<img src=x onerror=alert(1)>www.example.com/x)',
    `https://example.com/${'a'.repeat(256)}))!!`,
    'great site (https://example.com/🎉🎉🎉)',
    'موقع رائع (https://example.com/مرحبا/بكم/في/موقعي) شكرا',
  ])('renders the hostile note %j as text, in plain spans only', (text) => {
    const row = renderRow(message({ message: text }));
    const note = row.querySelector('li p');
    const elements = Array.from(note?.querySelectorAll('*') ?? []);

    expect(note?.textContent).toBe(text);
    expect(row.querySelector('script, img')).toBeNull();
    for (const element of elements) {
      expect(['SPAN', 'WBR']).toContain(element.tagName);
      expect(['', NOTE_ADDRESS_CLASS, NOTE_HELD_CLASS]).toContain(element.className);
    }
    expect(renderToString(<MessageRow message={message({ message: text })} />)).not.toMatch(
      /<(script|img)/,
    );
  });
});
