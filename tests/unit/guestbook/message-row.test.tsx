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
 * typed. The row never decodes entities: legacy records are decoded once by the loader, so text
 * that a visitor typed as '&amp;' (a new post, or the row still being posted) shows as typed.
 * The row's meta line is the author, then the month (no time of day).
 */

import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import type { GuestbookMessage } from '@/lib/guestbook/types';

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
});
