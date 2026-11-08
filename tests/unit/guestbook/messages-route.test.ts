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
 * @file The messages route's POST, through Elysia, with Firestore and the Admin SDK mocked
 * (nothing reaches the real guestbook). Whatever the browser did, the server holds the limits:
 * - a message over 280 characters, an author name over 80, or a missing field is refused by the
 *   body schema before anything is stored;
 * - a message with nothing left once markup is removed is answered 400, not 500, and nothing is
 *   stored or reported as a server failure;
 * - a good message is stored as checked plain text and answered 201.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  add: vi.fn(),
  report: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock('@/core/firebase', () => ({ firestore: {} }));
vi.mock('@/core/firebase-admin', () => ({ adminDb: { collection: () => ({ add: h.add }) } }));
vi.mock('@/config', () => ({ config: { firebase: { appId: 'test-app' } } }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.report }));

import { messagesRoute } from '@/app/api/v1/[[...route]]/messages';
import { resetGuestbookCache } from '@/lib/guestbook/messages';

const post = (body: unknown) =>
  messagesRoute.handle(
    new Request('http://localhost/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetGuestbookCache();
  h.add.mockResolvedValue({ id: 'new-doc' });
});

describe('POST /messages', () => {
  it('stores a good message as checked plain text and answers 201', async () => {
    const response = await post({ authorName: "D'Angelo & Co", message: ' Hi   there ' });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: 'new-doc',
      authorName: "D'Angelo & Co",
      message: 'Hi there',
    });
    expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ plainText: true }));
  });

  it.each([
    ['a message over 280 characters', { authorName: 'Ada', message: 'a'.repeat(281) }],
    ['an author name over 80 characters', { authorName: 'a'.repeat(81), message: 'Hello' }],
    ['no message', { authorName: 'Ada' }],
    ['an empty message', { authorName: 'Ada', message: '' }],
  ])('refuses %s before storing anything', async (_case, body) => {
    const response = await post(body);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(h.add).not.toHaveBeenCalled();
  });

  it('answers 400 to a message that is only markup, stores nothing and reports nothing', async () => {
    const response = await post({ authorName: 'Ada', message: '<b></b><img src=x>' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expect(h.add).not.toHaveBeenCalled();
    expect(h.report).not.toHaveBeenCalled();
  });
});
