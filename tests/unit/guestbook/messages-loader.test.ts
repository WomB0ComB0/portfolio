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
 * @file The guestbook's server loader keeps one stale-on-error cache per process, which a post
 * through the API expires. The page renders every message (up to a 500 safety cap, which it says
 * when it hits), never throws (a failed first load is the page's error state), and serves the last
 * good list, marked stale, when a reload fails or runs past its deadline; a read that ends after
 * the deadline still fills the cache. A message written through the API is checked on the server
 * (validateUserInput, the 280 character limit), stored as plain text (never HTML-escaped, marked
 * plainText) with the verified poster's name and uid, and the cached list is expired, not
 * dropped: the next render reads again, and if that read fails the previous list is still served,
 * marked stale. Who may post, and the name they post under, is the route's test
 * (messages-route.test.ts). Author names stored before
 * plain text (no marker) have the five basic entities decoded when read; message bodies and
 * plain-text records are never decoded.
 *
 * Firestore and the Admin SDK are mocked: nothing here reads or writes the real guestbook.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getDocs: vi.fn(),
  limit: vi.fn((count: number) => ({ limit: count })),
  orderBy: vi.fn((field: string, direction: string) => ({ orderBy: [field, direction] })),
  query: vi.fn((...parts: unknown[]) => ({ query: parts })),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  add: vi.fn(),
  adminCollection: vi.fn(),
  report: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: h.collection,
  getDocs: h.getDocs,
  limit: h.limit,
  orderBy: h.orderBy,
  query: h.query,
}));
vi.mock('@/core/firebase', () => ({ firestore: { kind: 'test-firestore' } }));
vi.mock('@/core/firebase-admin', () => ({ adminDb: { collection: h.adminCollection } }));
vi.mock('@/config', () => ({ config: { firebase: { appId: 'test-app' } } }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.report }));

import { createMessage, InvalidMessageError } from '@/app/api/v1/[[...route]]/messages/handlers';
import type { Poster } from '@/app/api/v1/[[...route]]/messages/poster';
import { AUTHOR_MAX_LENGTH, MESSAGE_MAX_LENGTH } from '@/lib/guestbook/limits';
import {
  expireGuestbookMessages,
  GUESTBOOK_DEADLINE_MS,
  GUESTBOOK_LOAD_TIMEOUT_MS,
  GUESTBOOK_MESSAGE_CAP,
  GUESTBOOK_TTL_MS,
  loadGuestbook,
  MESSAGES_COLLECTION_PATH,
  readGuestbookMessages,
  resetGuestbookCache,
} from '@/lib/guestbook/messages';

interface FakeDoc {
  readonly id: string;
  readonly data: () => Record<string, unknown>;
}

const doc = (index: number, fields: Record<string, unknown> = {}): FakeDoc => ({
  id: `doc-${index}`,
  data: () => ({
    authorName: `Visitor ${index}`,
    message: `Message ${index}`,
    createdAt: new Date(Date.UTC(2025, 9, 27, 9, 19) + index * 60_000).toISOString(),
    ...fields,
  }),
});

const docs = (count: number): FakeDoc[] => Array.from({ length: count }, (_, i) => doc(i));

/** A verified poster (synthetic): what the route passes to createMessage. */
const POSTER: Poster = { uid: 'uid-ada', authorName: "D'Angelo & Co" };
const snapshot = (list: FakeDoc[]) => ({ docs: list, size: list.length });

/** A Firestore read that answers when the test says so. */
function heldRead() {
  let answer: (value: unknown) => void = () => undefined;
  h.getDocs.mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        answer = (value) => (value instanceof Error ? reject(value) : resolve(value));
      }),
  );
  return (value: unknown) => answer(value);
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => {
  resetGuestbookCache();
  vi.clearAllMocks();
  h.adminCollection.mockReturnValue({ add: h.add });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadGuestbook', () => {
  it('loads every message, newest first, well past the old limit of 50', async () => {
    h.getDocs.mockResolvedValueOnce(snapshot(docs(60)));

    const load = await loadGuestbook();

    expect(load.state).toBe('ready');
    expect(load.messages).toHaveLength(60);
    expect(load.truncated).toBe(false);
    expect(h.collection).toHaveBeenCalledWith(
      { kind: 'test-firestore' },
      'artifacts/test-app/public/data/message',
    );
    expect(MESSAGES_COLLECTION_PATH).toBe('artifacts/test-app/public/data/message');
    expect(h.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    // One past the cap, so the loader can tell a full guestbook from a cut one.
    expect(h.limit).toHaveBeenCalledWith(GUESTBOOK_MESSAGE_CAP + 1);
  });

  it('stops at the 500-message safety cap and says the list was cut', async () => {
    h.getDocs.mockResolvedValueOnce(snapshot(docs(GUESTBOOK_MESSAGE_CAP + 1)));

    const load = await loadGuestbook();

    expect(GUESTBOOK_MESSAGE_CAP).toBe(500);
    expect(load.messages).toHaveLength(GUESTBOOK_MESSAGE_CAP);
    expect(load.truncated).toBe(true);
  });

  it('keeps plain text exactly as stored, and drops records that are not text', async () => {
    h.getDocs.mockResolvedValueOnce(
      snapshot([
        doc(1, { authorName: "D'Angelo & Co", message: "It's <b>fine</b>", plainText: true }),
        doc(2, { message: '   ' }),
        doc(3, { message: 42 }),
        doc(4, { createdAt: undefined }),
        doc(5, { authorName: '' }),
      ]),
    );

    const { messages } = await loadGuestbook();

    expect(messages.map((m) => m.id)).toEqual(['doc-1', 'doc-5']);
    expect(messages[0]).toMatchObject({ authorName: "D'Angelo & Co", message: "It's <b>fine</b>" });
    expect(messages[1]?.authorName).toBe('Anonymous');
  });

  it('never throws: a first load that fails is the error state, and it is reported', async () => {
    const outage = new Error('firestore unavailable');
    h.getDocs.mockRejectedValueOnce(outage);

    const load = await loadGuestbook();

    expect(load).toEqual({ state: 'error', messages: [], truncated: false, loadedAt: null });
    expect(h.report).toHaveBeenCalledWith(outage, { context: 'load guestbook messages' });
  });

  it('serves the last good list, marked stale, when a reload fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T12:00:00.000Z'));
    h.getDocs.mockResolvedValueOnce(snapshot(docs(3)));
    await loadGuestbook();
    const loadedAt = Date.now();

    vi.setSystemTime(loadedAt + GUESTBOOK_TTL_MS + 1);
    h.getDocs.mockRejectedValueOnce(new Error('firestore unavailable'));
    const load = await loadGuestbook();

    expect(load.state).toBe('stale');
    expect(load.messages).toHaveLength(3);
    expect(load.loadedAt).toBe(loadedAt);
    expect(h.report).toHaveBeenCalledWith(expect.any(Error), {
      context: 'load guestbook messages',
      level: 'warning',
    });
  });

  it('gives up on a read that runs past its deadline', async () => {
    vi.useFakeTimers();
    h.getDocs.mockReturnValueOnce(new Promise(() => {}));

    const pending = loadGuestbook();
    await vi.advanceTimersByTimeAsync(GUESTBOOK_DEADLINE_MS);

    expect((await pending).state).toBe('error');
  });

  it('caches a read that ends after the deadline, so the next render needs no second read', async () => {
    vi.useFakeTimers();
    const answer = heldRead();

    const first = loadGuestbook();
    await vi.advanceTimersByTimeAsync(GUESTBOOK_DEADLINE_MS);
    expect((await first).state).toBe('error');

    answer(snapshot(docs(2)));
    await flush();
    const second = await loadGuestbook();

    expect(second.state).toBe('ready');
    expect(second.messages).toHaveLength(2);
    expect(h.getDocs).toHaveBeenCalledTimes(1);
  });

  it('shows the last list, stale, when a reload runs past the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T12:00:00.000Z'));
    h.getDocs.mockResolvedValueOnce(snapshot(docs(3)));
    await loadGuestbook();
    const loadedAt = Date.now();
    vi.setSystemTime(loadedAt + GUESTBOOK_TTL_MS + 1);
    h.getDocs.mockReturnValueOnce(new Promise(() => {}));

    const pending = loadGuestbook();
    await vi.advanceTimersByTimeAsync(GUESTBOOK_DEADLINE_MS);
    const load = await pending;

    expect(load.state).toBe('stale');
    expect(load.messages).toHaveLength(3);
    expect(load.loadedAt).toBe(loadedAt);
  });

  it('lets a read that never answers go after the load timeout, so a later render reads again', async () => {
    vi.useFakeTimers();
    h.getDocs.mockReturnValueOnce(new Promise(() => {}));
    const first = loadGuestbook();
    await vi.advanceTimersByTimeAsync(GUESTBOOK_LOAD_TIMEOUT_MS);
    expect((await first).state).toBe('error');

    h.getDocs.mockResolvedValueOnce(snapshot(docs(1)));
    const second = await loadGuestbook();

    expect(GUESTBOOK_LOAD_TIMEOUT_MS).toBeGreaterThan(GUESTBOOK_DEADLINE_MS);
    expect(second.state).toBe('ready');
    expect(h.getDocs).toHaveBeenCalledTimes(2);
  });

  // The old client escaped author names (escapeHtml) and never a message body, so only a legacy
  // name is decoded; every body is shown exactly as stored.
  it('decodes the five basic entities only in author names stored before plain text', async () => {
    h.getDocs.mockResolvedValueOnce(
      snapshot([
        doc(1, {
          authorName: 'D&#039;Angelo &amp; Co',
          message: 'Write &amp;amp; for an ampersand',
        }),
        doc(2, {
          authorName: 'Tom &amp; Jerry',
          message: 'Write &amp; for an ampersand, use &lt;br&gt;',
          plainText: true,
        }),
      ]),
    );

    const { messages } = await loadGuestbook();

    expect(messages[0]).toMatchObject({
      authorName: "D'Angelo & Co",
      message: 'Write &amp;amp; for an ampersand',
    });
    expect(messages[1]).toMatchObject({
      authorName: 'Tom &amp; Jerry',
      message: 'Write &amp; for an ampersand, use &lt;br&gt;',
    });
  });

  it('clips a stored message and author name to their limits', async () => {
    h.getDocs.mockResolvedValueOnce(
      snapshot([doc(1, { authorName: 'n'.repeat(200), message: 'm'.repeat(5_000) })]),
    );

    const { messages } = await loadGuestbook();

    expect(messages[0]?.message).toHaveLength(MESSAGE_MAX_LENGTH);
    expect(messages[0]?.authorName).toHaveLength(AUTHOR_MAX_LENGTH);
  });
});

describe('a post through the API and the shared cache', () => {
  it('reads once within the TTL, however many reads ask', async () => {
    h.getDocs.mockResolvedValueOnce(snapshot(docs(2)));

    const first = await readGuestbookMessages();
    const page = await loadGuestbook();

    expect(h.getDocs).toHaveBeenCalledTimes(1);
    expect(first.data.messages.map((m) => m.id)).toEqual(page.messages.map((m) => m.id));
    expect((await readGuestbookMessages()).stale).toBe(false);
  });

  it("stores a posted message as plain text with the poster's uid, then expires the cached list", async () => {
    h.getDocs.mockResolvedValue(snapshot(docs(1)));
    h.add.mockResolvedValueOnce({ id: 'new-doc' });
    await loadGuestbook();

    const saved = await createMessage({ message: "It's me & you" }, POSTER);

    expect(h.adminCollection).toHaveBeenCalledWith('artifacts/test-app/public/data/message');
    expect(h.add).toHaveBeenCalledWith({
      authorName: "D'Angelo & Co",
      message: "It's me & you",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      plainText: true,
      uid: 'uid-ada',
    });
    expect(saved).toEqual({
      id: 'new-doc',
      authorName: "D'Angelo & Co",
      message: "It's me & you",
      createdAt: expect.any(String),
    });

    await loadGuestbook();
    expect(h.getDocs).toHaveBeenCalledTimes(2);
  });

  it('checks the text on the server: tags and script schemes go, whitespace collapses', async () => {
    h.add.mockResolvedValueOnce({ id: 'new-doc' });

    await createMessage(
      { message: '  Hi <script>x</script>   there javascript:alert(1) ' },
      POSTER,
    );

    expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ message: 'Hi x there alert(1)' }));
  });

  it.each([
    ['empty', '   '],
    ['only tags', '<b></b><img src=x>'],
    ['over 280 characters', 'a'.repeat(MESSAGE_MAX_LENGTH + 1)],
  ])('rejects a message that is %s, stores nothing and keeps the cache', async (_case, message) => {
    h.getDocs.mockResolvedValue(snapshot(docs(1)));
    await loadGuestbook();

    await expect(createMessage({ message }, POSTER)).rejects.toBeInstanceOf(InvalidMessageError);

    expect(h.add).not.toHaveBeenCalled();
    await loadGuestbook();
    expect(h.getDocs).toHaveBeenCalledTimes(1);
  });

  it('keeps the last list after a post: a failing reload serves it stale, not the error state', async () => {
    h.getDocs.mockResolvedValueOnce(snapshot(docs(2)));
    h.add.mockResolvedValueOnce({ id: 'new-doc' });
    await loadGuestbook();

    await createMessage({ message: 'Hello' }, POSTER);
    h.getDocs.mockRejectedValueOnce(new Error('firestore down'));
    const load = await loadGuestbook();

    expect(load.state).toBe('stale');
    expect(load.messages.map((m) => m.id)).toEqual(['doc-0', 'doc-1']);
  });

  it('never caches a read that started before a post as the fresh list', async () => {
    h.add.mockResolvedValueOnce({ id: 'new-doc' });
    const answerBefore = heldRead();
    const answerAfter = heldRead();
    const before = readGuestbookMessages();
    await flush();

    await createMessage({ message: 'Hello' }, POSTER);
    const after = readGuestbookMessages();
    await flush();
    answerAfter(snapshot([doc(9, { message: 'after the post' }), doc(1)]));
    await after;
    answerBefore(snapshot([doc(1)]));
    await before;

    const next = await readGuestbookMessages();
    expect(h.getDocs).toHaveBeenCalledTimes(2);
    expect(next.data.messages.map((m) => m.message)).toEqual(['after the post', 'Message 1']);
  });

  it('expireGuestbookMessages makes the next read ask Firestore again', async () => {
    h.getDocs.mockResolvedValue(snapshot(docs(1)));
    await readGuestbookMessages();

    expireGuestbookMessages();
    await readGuestbookMessages();

    expect(h.getDocs).toHaveBeenCalledTimes(2);
  });
});
