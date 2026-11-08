// @vitest-environment node
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
 * (verifyIdToken and the collection's add are fakes: nothing reaches the real guestbook or
 * Firebase Auth). Whatever the browser did, the server holds the rules:
 * - only a signed-in visitor posts: a request without `Authorization: Bearer <Firebase ID token>`,
 *   with a header that is not one, or with a token verifyIdToken rejects (invalid, expired) is
 *   answered 401 with one fixed JSON error, and nothing is written; only the refused token's
 *   Firebase code is logged, as an error (production drops warnings);
 * - the token is checked without the revocation lookup (one local signature check);
 * - a message over 280 characters or a missing one is refused by the body schema, before the token
 *   is even checked; a message with nothing left once markup is removed is answered 400;
 * - a good message is stored once, as checked plain text, with the poster's uid, under the name
 *   their Google or GitHub sign-in carries ('Anonymous' for a guest or a sign-in method the site
 *   does not offer, whatever name the body claims) and answered 201; when the token cannot be
 *   checked for a server-side reason (the Admin app misconfigured included) the answer is a
 *   generic, reported 500.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  add: vi.fn(),
  report: vi.fn(),
  verifyIdToken: vi.fn(),
  getAdminAuth: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock('@/core/firebase', () => ({ firestore: {} }));
vi.mock('@/core/firebase-admin', () => ({
  adminDb: { collection: () => ({ add: h.add }) },
  getAdminAuth: h.getAdminAuth,
}));
vi.mock('@/config', () => ({ config: { firebase: { appId: 'test-app' } } }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.report }));

import { messagesRoute } from '@/app/api/v1/[[...route]]/messages';
import { resetGuestbookCache } from '@/lib/guestbook/messages';

/** JWT-shaped (three dot-separated base64url parts), not a real token. */
const TOKEN = 'test-header.test-payload.test-signature';

/** What verifyIdToken resolves with for a Google sign-in (synthetic). */
const GOOGLE_USER = {
  uid: 'uid-ada',
  name: 'Ada Lovelace',
  firebase: { sign_in_provider: 'google.com', identities: {} },
};
/** A guest who set a display name on their anonymous account. */
const GUEST_USER = {
  uid: 'uid-guest',
  name: 'Mike Odnis',
  firebase: { sign_in_provider: 'anonymous', identities: {} },
};

const authError = (code: string) =>
  Object.assign(new Error(`Firebase ID token problem (${code}). Expected "secret-project-id"`), {
    code,
  });

const post = (body: unknown, authorization?: string) =>
  messagesRoute.handle(
    new Request('http://localhost/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: JSON.stringify(body),
    }),
  );

const signedIn = (body: unknown) => post(body, `Bearer ${TOKEN}`);

beforeEach(() => {
  vi.clearAllMocks();
  resetGuestbookCache();
  h.add.mockResolvedValue({ id: 'new-doc' });
  h.verifyIdToken.mockResolvedValue(GOOGLE_USER);
  h.getAdminAuth.mockReturnValue({ verifyIdToken: h.verifyIdToken });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /messages: who may post', () => {
  it('answers 401 without an Authorization header, and writes nothing', async () => {
    const response = await post({ message: 'Hello' });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="guestbook"');
    await expect(response.json()).resolves.toEqual({ error: expect.stringMatching(/sign in/i) });
    expect(h.verifyIdToken).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it.each([
    ['another scheme', `Basic ${TOKEN}`],
    ['a bare scheme', 'Bearer'],
    ['an empty token', 'Bearer   '],
    ['a token that is not a JWT', 'Bearer not-a-jwt'],
    ['a token with two parts', 'Bearer header.payload'],
    ['two tokens', `Bearer ${TOKEN} ${TOKEN}`],
    ['a token with a character outside base64url', 'Bearer a.b+c.d'],
    ['an oversized token', `Bearer ${'a'.repeat(5_000)}.b.c`],
  ])('answers 401 to %s without checking it or writing', async (_case, authorization) => {
    const response = await post({ message: 'Hello' }, authorization);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
    expect(h.verifyIdToken).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', 'auth/argument-error'],
    ['expired', 'auth/id-token-expired'],
    ['revoked', 'auth/id-token-revoked'],
    ['for a disabled account', 'auth/user-disabled'],
  ])(
    'answers 401 to a token that is %s, without its details, and writes nothing',
    async (_case, code) => {
      h.verifyIdToken.mockRejectedValueOnce(authError(code));

      const response = await signedIn({ message: 'Hello' });
      const text = await response.text();

      expect(response.status).toBe(401);
      expect(JSON.parse(text)).toEqual({ error: expect.stringMatching(/sign in/i) });
      expect(text).not.toMatch(/auth\/|secret-project-id|Firebase ID token/);
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="guestbook", error="invalid_token"',
      );
      expect(h.add).not.toHaveBeenCalled();
      expect(h.report).not.toHaveBeenCalled();
    },
  );

  it('logs only the code of a refused token, as an error so production keeps it', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.verifyIdToken.mockRejectedValueOnce(authError('auth/argument-error'));

    await signedIn({ message: 'Hello' });

    const logged = errors.mock.calls.flat().map(String).join(' ');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(logged).toContain('auth/argument-error');
    expect(logged).not.toMatch(/secret-project-id|Firebase ID token problem/);
    expect(logged).not.toContain(TOKEN);
    expect(warnings).not.toHaveBeenCalled();
  });

  it('answers a generic 500 and reports it when the Admin app cannot check tokens at all', async () => {
    h.getAdminAuth.mockImplementationOnce(() => {
      throw new Error('GCP_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID name different projects');
    });

    const response = await signedIn({ message: 'Hello' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/GCP_PROJECT_ID|NEXT_PUBLIC/);
    expect(h.verifyIdToken).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
    expect(h.report).toHaveBeenCalledTimes(1);
  });

  it('answers the same 401 body whether the token is missing or rejected', async () => {
    h.verifyIdToken.mockRejectedValueOnce(authError('auth/argument-error'));

    const missing = await (await post({ message: 'Hello' })).json();
    const rejected = await (await signedIn({ message: 'Hello' })).json();

    expect(rejected).toEqual(missing);
  });

  it('checks the token with one signature check, not the revocation lookup', async () => {
    await signedIn({ message: 'Hello' });

    expect(h.verifyIdToken).toHaveBeenCalledTimes(1);
    expect(h.verifyIdToken).toHaveBeenCalledWith(TOKEN);
  });

  it('accepts the scheme in any case', async () => {
    const response = await post({ message: 'Hello' }, `bearer ${TOKEN}`);

    expect(response.status).toBe(201);
  });

  it.each([
    ['the SDK has no project id', authError('auth/invalid-credential')],
    ['the SDK fails inside', authError('auth/internal-error')],
    ['something else throws', new TypeError('Cannot read properties of undefined')],
  ])('answers a generic 500 when %s, reports it, and writes nothing', async (_case, error) => {
    h.verifyIdToken.mockRejectedValueOnce(error);

    const response = await signedIn({ message: 'Hello' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: expect.any(String) });
    expect(text).not.toMatch(/auth\/|secret-project-id|Cannot read/);
    expect(h.add).not.toHaveBeenCalled();
    expect(h.report).toHaveBeenCalledTimes(1);
  });
});

describe('POST /messages: what is stored', () => {
  it('stores a good message once, as checked plain text with the uid, and answers 201', async () => {
    const response = await signedIn({ message: ' Hi   there ' });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'new-doc',
      authorName: 'Ada Lovelace',
      message: 'Hi there',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(h.add).toHaveBeenCalledTimes(1);
    expect(h.add).toHaveBeenCalledWith({
      authorName: 'Ada Lovelace',
      message: 'Hi there',
      createdAt: expect.any(String),
      plainText: true,
      uid: 'uid-ada',
    });
  });

  it('never sends the uid back', async () => {
    const response = await signedIn({ message: 'Hello' });

    expect(await response.json()).not.toHaveProperty('uid');
  });

  it('stores the name the sign-in carries, whatever name the body claims', async () => {
    const response = await signedIn({ authorName: 'Someone Else', message: 'Hello' });

    expect(response.status).toBe(201);
    expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'Ada Lovelace' }));
  });

  it('stores a guest as Anonymous, even with a display name set on the guest account', async () => {
    h.verifyIdToken.mockResolvedValueOnce(GUEST_USER);

    const response = await signedIn({ message: 'Hello from a guest' });

    expect(response.status).toBe(201);
    expect(h.add).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: 'Anonymous', uid: 'uid-guest' }),
    );
  });

  it('stores the name of a GitHub sign-in', async () => {
    h.verifyIdToken.mockResolvedValueOnce({
      uid: 'uid-grace',
      name: 'Grace Hopper',
      firebase: { sign_in_provider: 'github.com', identities: {} },
    });

    await signedIn({ message: 'Hello' });

    expect(h.add).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: 'Grace Hopper', uid: 'uid-grace' }),
    );
  });

  it.each([
    ['email and password', 'password'],
    ['a phone number', 'phone'],
    ['a custom token', 'custom'],
    ['no provider at all', undefined],
  ])(
    'stores a sign-in the site does not offer (%s) as Anonymous, whatever its name',
    async (_case, provider) => {
      h.verifyIdToken.mockResolvedValueOnce({
        uid: 'uid-other',
        name: 'Mike Odnis',
        firebase: { sign_in_provider: provider, identities: {} },
      });

      const response = await signedIn({ message: 'Hello' });

      expect(response.status).toBe(201);
      expect(h.add).toHaveBeenCalledWith(
        expect.objectContaining({ authorName: 'Anonymous', uid: 'uid-other' }),
      );
    },
  );

  it('stores a signed-in visitor with no name as Anonymous, and checks a name like typed text', async () => {
    h.verifyIdToken
      .mockResolvedValueOnce({ ...GOOGLE_USER, name: undefined })
      .mockResolvedValueOnce({ ...GOOGLE_USER, name: '  <b>Ada</b>  ' })
      .mockResolvedValueOnce({ ...GOOGLE_USER, name: 'n'.repeat(120) });

    await signedIn({ message: 'One' });
    await signedIn({ message: 'Two' });
    await signedIn({ message: 'Three' });

    expect(h.add.mock.calls.map(([record]) => record.authorName)).toEqual([
      'Anonymous',
      'Ada',
      'n'.repeat(80),
    ]);
  });

  it.each([
    ['a message over 280 characters', { message: 'a'.repeat(281) }],
    ['no message', {}],
    ['an empty message', { message: '' }],
  ])('refuses %s before checking the token or storing anything', async (_case, body) => {
    const response = await signedIn(body);

    // The schema's own answer here (422); createElysiaApp's error handler makes it a 400.
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(h.verifyIdToken).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it('answers 400 to a message that is only markup, stores nothing and reports nothing', async () => {
    const response = await signedIn({ message: '<b></b><img src=x>' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expect(h.add).not.toHaveBeenCalled();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('answers a generic 500 when the write fails', async () => {
    h.add.mockRejectedValueOnce(new Error('firestore down: project secret-project-id'));

    const response = await signedIn({ message: 'Hello' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/secret-project-id/);
  });
});

describe('GET /messages', () => {
  it('is not a route any more', async () => {
    const response = await messagesRoute.handle(new Request('http://localhost/messages'));

    expect(response.status).toBe(404);
    expect(h.add).not.toHaveBeenCalled();
  });
});
