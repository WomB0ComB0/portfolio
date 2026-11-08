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
 * @file The messages route's POST, through Elysia, with Firestore mocked (the write batch is a
 * fake: nothing reaches the real guestbook) and Google's securetoken keys replaced by a local key
 * set: every token here is signed in the test with a key generated for it, and checked by the real
 * verifier (jose). Nothing calls Google or Firebase Auth. Whatever the browser did, the server
 * holds the rules:
 * - only a signed-in visitor posts: a request without `Authorization: Bearer <Firebase ID token>`,
 *   with a header that is not one, or with a token the verifier refuses (expired, another project,
 *   not signed by one of the keys, no uid) is answered 401 with one fixed JSON error, and nothing
 *   is written; only the refusal's code (and the claim it failed on) is logged, as an error
 *   (production drops warnings);
 * - the token is checked locally against the key set, once, with no lookup of the account;
 * - a message over 280 characters or a missing one is refused by the body schema, before the token
 *   is even checked; a message with nothing left once markup is removed is answered 400;
 * - a good message is stored once, as checked plain text, under the name their Google or GitHub
 *   sign-in carries ('Anonymous' for a guest or a sign-in method the site does not offer, whatever
 *   name the body claims) and answered 201. The public message, which anyone can read, has no
 *   uid: the poster's uid goes to a server-only document with the same id, in the same batch;
 * - when the token cannot be checked for a server-side reason (the server's Firebase project is
 *   not the browser's, or Google's keys cannot be fetched) the answer is a generic, reported 500,
 *   so the browser does not sign the visitor out.
 */

import {
  createIdTokenSigner,
  type IdTokenSigner,
  TEST_KEY_ID,
  TEST_PROJECT_ID,
  type TestClaims,
} from '@tests/setup/firebase-id-tokens';
import { errors, type JWTVerifyGetKey } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRef {
  readonly id: string;
  readonly path: string;
}

const h = vi.hoisted(() => ({
  create: vi.fn(),
  commit: vi.fn(),
  report: vi.fn(),
  keys: vi.fn(),
  /** Synthetic: the server's and the browser's Firebase project. */
  env: {} as Record<string, string>,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock('@/core/firebase', () => ({ firestore: {} }));
vi.mock('@/core/firebase-admin', () => {
  const batch = {
    create: (ref: FakeRef, data: unknown) => {
      h.create(ref, data);
      return batch;
    },
    commit: h.commit,
  };
  return {
    adminDb: {
      collection: (path: string) => ({
        doc: (id = 'new-doc'): FakeRef => ({ id, path: `${path}/${id}` }),
      }),
      batch: () => batch,
    },
  };
});
// Google's key set is the local one; the verifier itself is the real one.
vi.mock('@/core/firebase-id-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/firebase-id-token')>()),
  googleIdTokenKeys: () => h.keys,
}));
vi.mock('@/env', () => ({ env: h.env, default: h.env }));
vi.mock('@/config', () => ({ config: { firebase: { appId: 'test-app' } } }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.report }));

import { messagesRoute } from '@/app/api/v1/[[...route]]/messages';
import { resetGuestbookCache } from '@/lib/guestbook/messages';

/** JWT-shaped (three dot-separated base64url parts), not a real token. */
const TOKEN = 'test-header.test-payload.test-signature';

let signer: IdTokenSigner;

beforeAll(async () => {
  signer = await createIdTokenSigner();
});

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

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

/** Posts with a token signed for the test project: a Google sign-in, with `claims` over it. */
const signedIn = async (body: unknown, claims: TestClaims = {}) =>
  post(body, `Bearer ${await signer.sign(claims)}`);

/** A sign-in with `provider` (left out of the token when undefined) and the given name. */
const signInWith = (provider: string | undefined, sub: string, name?: string): TestClaims => ({
  sub,
  name,
  firebase: { sign_in_provider: provider, identities: {} },
});

/** The public messages, which anyone can read, and the server-only record of who posted each. */
const MESSAGES = 'artifacts/test-app/public/data/message';
const POSTERS = 'artifacts/test-app/private/data/messagePoster';

/** What the batch creates under `collection`, in order. */
const createdIn = (collection: string): Record<string, unknown>[] =>
  h.create.mock.calls
    .filter(([ref]) => (ref as FakeRef).path.startsWith(`${collection}/`))
    .map(([, data]) => data as Record<string, unknown>);

const expectNothingWritten = () => {
  expect(h.create).not.toHaveBeenCalled();
  expect(h.commit).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  resetGuestbookCache();
  Object.assign(h.env, {
    NODE_ENV: 'test',
    GCP_PROJECT_ID: TEST_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
  });
  h.commit.mockResolvedValue([]);
  h.keys.mockImplementation(((header, token) => signer.keys(header, token)) as JWTVerifyGetKey);
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
    expect(h.keys).not.toHaveBeenCalled();
    expectNothingWritten();
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
    expect(h.keys).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it.each([
    ['that has expired', () => signer.sign({ exp: nowInSeconds() - 3_600 })],
    [
      'for another Firebase project',
      () =>
        signer.sign({
          aud: 'other-project',
          iss: 'https://securetoken.google.com/other-project',
        }),
    ],
    ["signed by a key that is not Google's", () => signer.sign({}, { withStrangerKey: true })],
    ['naming a key Google does not publish', () => signer.sign({}, { header: { kid: 'gone' } })],
    ['with no uid', () => signer.sign({ sub: '' })],
    ['that is only JWT-shaped', async () => TOKEN],
  ])(
    'answers 401 to a token %s, without its details, and writes nothing',
    async (_case, makeToken) => {
      const response = await post({ message: 'Hello' }, `Bearer ${await makeToken()}`);
      const text = await response.text();

      expect(response.status).toBe(401);
      expect(JSON.parse(text)).toEqual({ error: expect.stringMatching(/sign in/i) });
      expect(text).not.toMatch(/ERR_|other-project|claim|signature/);
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="guestbook", error="invalid_token"',
      );
      expectNothingWritten();
      expect(h.report).not.toHaveBeenCalled();
    },
  );

  it('logs only the code of a refused token and its claim, as an error so production keeps it', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const token = await signer.sign({ exp: nowInSeconds() - 3_600 });

    await post({ message: 'Hello' }, `Bearer ${token}`);

    const logged = errorLog.mock.calls.flat().map(String).join(' ');
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(logged).toContain('ERR_JWT_EXPIRED');
    expect(logged).toContain('exp');
    expect(logged).not.toContain(token);
    expect(logged).not.toMatch(/uid-ada|Ada Lovelace|timestamp check failed/);
    expect(warnings).not.toHaveBeenCalled();
  });

  it("answers a generic, reported 500 when the server's Firebase project is not the browser's", async () => {
    h.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'other-project';

    const response = await signedIn({ message: 'Hello' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/GCP_PROJECT_ID|NEXT_PUBLIC|other-project/);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(h.keys).not.toHaveBeenCalled();
    expectNothingWritten();
    expect(h.report).toHaveBeenCalledTimes(1);
  });

  it('answers the same 401 body whether the token is missing or refused', async () => {
    const missing = await (await post({ message: 'Hello' })).json();
    const refused = await (await signedIn({ message: 'Hello' }, { aud: 'other-project' })).json();

    expect(refused).toEqual(missing);
  });

  it("checks the token once, against Google's key set, by the key it names", async () => {
    await signedIn({ message: 'Hello' });

    expect(h.keys).toHaveBeenCalledTimes(1);
    expect(h.keys).toHaveBeenCalledWith(
      expect.objectContaining({ alg: 'RS256', kid: TEST_KEY_ID }),
      expect.anything(),
    );
  });

  it('accepts the scheme in any case', async () => {
    const response = await post({ message: 'Hello' }, `bearer ${await signer.sign()}`);

    expect(response.status).toBe(201);
  });

  it.each([
    ['fetching them times out', () => new errors.JWKSTimeout()],
    ['the network fails', () => new TypeError('fetch failed: getaddrinfo ENOTFOUND googleapis')],
    [
      'Google answers something other than the keys',
      () => new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    ],
    ['the answer is not a key set', () => new errors.JWKSInvalid('JSON Web Key Set malformed')],
    ['something else throws', () => new TypeError('Cannot read properties of undefined')],
  ])(
    "answers a generic, reported 500 when Google's keys cannot be had (%s), not a 401",
    async (_case, makeError) => {
      h.keys.mockRejectedValueOnce(makeError());

      const response = await signedIn({ message: 'Hello' });
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual({ error: expect.any(String) });
      expect(text).not.toMatch(/googleapis|timed out|fetch failed|Expected 200|Cannot read/);
      expect(response.headers.get('www-authenticate')).toBeNull();
      expectNothingWritten();
      expect(h.report).toHaveBeenCalledTimes(1);
    },
  );

  /** The 500 body for a failed write: every other server-side failure must answer exactly this. */
  const writeFailureBody = async (): Promise<string> => {
    h.commit.mockRejectedValueOnce(new Error('firestore down: project secret-project-id'));
    const response = await signedIn({ message: 'Hello' });
    expect(response.status).toBe(500);
    return response.text();
  };

  it('answers a failed write with a fixed body that names nothing internal', async () => {
    const body = await writeFailureBody();

    expect(JSON.parse(body)).toEqual({ error: expect.any(String) });
    expect(body).not.toMatch(
      /secret-project-id|firestore down|GCP_PROJECT_ID|NEXT_PUBLIC|googleapis|JWKS|ERR_/,
    );
  });

  it.each([
    [
      "the server's project is not the browser's",
      () => {
        h.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'other-project';
      },
    ],
    [
      'the server has no project',
      () => {
        h.env.GCP_PROJECT_ID = '';
      },
    ],
    [
      "Google's keys time out",
      () => {
        h.keys.mockRejectedValueOnce(new errors.JWKSTimeout());
      },
    ],
    [
      'the network fails',
      () => {
        h.keys.mockRejectedValueOnce(
          new TypeError('fetch failed: getaddrinfo ENOTFOUND googleapis'),
        );
      },
    ],
    [
      'Google answers something other than the keys',
      () => {
        h.keys.mockRejectedValueOnce(
          new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
        );
      },
    ],
  ])('answers the same 500 body as a failed write when %s', async (_case, arrange) => {
    const reference = await writeFailureBody();
    arrange();

    const response = await signedIn({ message: 'Hello' });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe(reference);
  });
});

describe('POST /messages: what is stored', () => {
  it('stores a good message once, as checked plain text without the uid, and answers 201', async () => {
    const response = await signedIn({ message: ' Hi   there ' });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      id: 'new-doc',
      authorName: 'Ada Lovelace',
      message: 'Hi there',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(createdIn(MESSAGES)).toEqual([
      {
        authorName: 'Ada Lovelace',
        message: 'Hi there',
        createdAt: body.createdAt,
        plainText: true,
      },
    ]);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it("keeps the poster's uid off the public message, in a server-only record with the same id", async () => {
    const response = await signedIn({ message: 'Hello' });
    const { createdAt } = await response.json();

    expect(createdIn(MESSAGES)[0]).not.toHaveProperty('uid');
    expect(h.create).toHaveBeenCalledWith(
      { id: 'new-doc', path: `${POSTERS}/new-doc` },
      { uid: 'uid-ada', createdAt },
    );
    // Both in the one batch: they land together or not at all.
    expect(h.create).toHaveBeenCalledTimes(2);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it('never sends the uid back', async () => {
    const response = await signedIn({ message: 'Hello' });

    expect(await response.json()).not.toHaveProperty('uid');
  });

  it('stores the name the sign-in carries, whatever name the body claims', async () => {
    const response = await signedIn({ authorName: 'Someone Else', message: 'Hello' });

    expect(response.status).toBe(201);
    expect(createdIn(MESSAGES)).toEqual([expect.objectContaining({ authorName: 'Ada Lovelace' })]);
  });

  it('stores a guest as Anonymous, even with a display name set on the guest account', async () => {
    const response = await signedIn(
      { message: 'Hello from a guest' },
      signInWith('anonymous', 'uid-guest', 'Mike Odnis'),
    );

    expect(response.status).toBe(201);
    expect(createdIn(MESSAGES)).toEqual([expect.objectContaining({ authorName: 'Anonymous' })]);
    expect(createdIn(POSTERS)).toEqual([expect.objectContaining({ uid: 'uid-guest' })]);
  });

  it('stores the name of a GitHub sign-in', async () => {
    await signedIn({ message: 'Hello' }, signInWith('github.com', 'uid-grace', 'Grace Hopper'));

    expect(createdIn(MESSAGES)).toEqual([expect.objectContaining({ authorName: 'Grace Hopper' })]);
    expect(createdIn(POSTERS)).toEqual([expect.objectContaining({ uid: 'uid-grace' })]);
  });

  it.each([
    ['email and password', 'password'],
    ['a phone number', 'phone'],
    ['a custom token', 'custom'],
    ['no provider at all', undefined],
  ])(
    'stores a sign-in the site does not offer (%s) as Anonymous, whatever its name',
    async (_case, provider) => {
      const response = await signedIn(
        { message: 'Hello' },
        signInWith(provider, 'uid-other', 'Mike Odnis'),
      );

      expect(response.status).toBe(201);
      expect(createdIn(MESSAGES)).toEqual([expect.objectContaining({ authorName: 'Anonymous' })]);
      expect(createdIn(POSTERS)).toEqual([expect.objectContaining({ uid: 'uid-other' })]);
    },
  );

  it('stores a signed-in visitor with no name as Anonymous, and checks a name like typed text', async () => {
    await signedIn({ message: 'One' }, { name: undefined });
    await signedIn({ message: 'Two' }, { name: '  <b>Ada</b>  ' });
    await signedIn({ message: 'Three' }, { name: 'n'.repeat(120) });

    expect(createdIn(MESSAGES).map((record) => record.authorName)).toEqual([
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
    expect(h.keys).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('answers 400 to a message that is only markup, stores nothing and reports nothing', async () => {
    const response = await signedIn({ message: '<b></b><img src=x>' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expectNothingWritten();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('answers a generic 500, and reports it, when the write fails', async () => {
    h.commit.mockRejectedValueOnce(new Error('firestore down: project secret-project-id'));

    const response = await signedIn({ message: 'Hello' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/secret-project-id/);
    expect(h.report).toHaveBeenCalledTimes(1);
  });
});

describe('GET /messages', () => {
  it('is not a route any more', async () => {
    const response = await messagesRoute.handle(new Request('http://localhost/messages'));

    expect(response.status).toBe(404);
    expectNothingWritten();
  });
});
