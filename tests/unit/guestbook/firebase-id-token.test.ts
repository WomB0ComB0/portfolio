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
 * @file Checking a Firebase ID token with jose (src/core/firebase-id-token.ts), by the rules
 * Firebase documents for verifying one without the Admin SDK: RS256 only, signed by one of
 * Google's securetoken keys (named by its kid), for this project (aud, and iss
 * https://securetoken.google.com/<project>), not expired, issued and authenticated in the past
 * (a few seconds of clock skew allowed), with a non-empty subject, which is the uid.
 *
 * A token that fails any of these is refused (`ok: false` with jose's code, never thrown), which
 * the route answers 401. A failure to get the keys (Google unreachable, slow, or answering
 * something that is not a key set) is thrown, which the route answers with a reported 500, so a
 * valid visitor is not signed out.
 *
 * Every key and token is generated here; Google's key set is either a local one or the real
 * remote-set code over a fake fetch. Nothing calls Google or Firebase.
 */

import {
  createIdTokenSigner,
  defaultClaims,
  type IdTokenSigner,
  TEST_KEY_ID,
  TEST_PROJECT_ID,
} from '@tests/setup/firebase-id-tokens';
import {
  errors,
  type FetchImplementation,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
  UnsecuredJWT,
} from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createGoogleIdTokenKeys,
  createIdTokenVerifier,
  FIREBASE_ID_TOKEN_KEYS_URL,
  FirebaseProjectMismatchError,
  googleIdTokenKeys,
  ID_TOKEN_CLOCK_TOLERANCE_SECONDS,
  idTokenProjectId,
} from '@/core/firebase-id-token';

let signer: IdTokenSigner;

beforeAll(async () => {
  signer = await createIdTokenSigner();
});

const now = (): number => Math.floor(Date.now() / 1000);
const later = (): number => now() + 60;

const CLAIM_FAILED = 'ERR_JWT_CLAIM_VALIDATION_FAILED';

const verifierOver = (keys: JWTVerifyGetKey = signer.keys) =>
  createIdTokenVerifier({ projectId: TEST_PROJECT_ID, keys });

describe('createIdTokenVerifier: a token Firebase issued for this project', () => {
  it('is accepted, with the subject as the uid and the claims as signed', async () => {
    const check = await verifierOver()(await signer.sign());

    expect(check).toEqual({
      ok: true,
      token: expect.objectContaining({
        uid: 'uid-ada',
        sub: 'uid-ada',
        name: 'Ada Lovelace',
        firebase: { sign_in_provider: 'google.com', identities: {} },
      }),
    });
  });

  it('is accepted when issued a few seconds ahead of the server clock', async () => {
    const ahead = now() + Math.floor(ID_TOKEN_CLOCK_TOLERANCE_SECONDS / 2);

    const check = await verifierOver()(await signer.sign({ iat: ahead, auth_time: ahead }));

    expect(check.ok).toBe(true);
  });

  it('cannot be made without a project id', () => {
    expect(() => createIdTokenVerifier({ projectId: '', keys: signer.keys })).toThrow(TypeError);
  });
});

describe('createIdTokenVerifier: a token that breaks a claim rule is refused', () => {
  it.each([
    [
      'expired',
      () => ({ exp: now() - ID_TOKEN_CLOCK_TOLERANCE_SECONDS - 1 }),
      'ERR_JWT_EXPIRED',
      'exp',
    ],
    ['without an expiry', () => ({ exp: undefined }), CLAIM_FAILED, 'exp'],
    ['for another project', () => ({ aud: 'other-project' }), CLAIM_FAILED, 'aud'],
    [
      'for a list of audiences that includes this project',
      () => ({ aud: [TEST_PROJECT_ID, 'other-project'] }),
      CLAIM_FAILED,
      'aud',
    ],
    [
      "from another project's issuer",
      () => ({ iss: 'https://securetoken.google.com/other-project' }),
      CLAIM_FAILED,
      'iss',
    ],
    [
      'from an issuer that is not securetoken',
      () => ({ iss: 'https://accounts.google.com' }),
      CLAIM_FAILED,
      'iss',
    ],
    ['without a subject', () => ({ sub: undefined }), CLAIM_FAILED, 'sub'],
    ['with an empty subject', () => ({ sub: '' }), CLAIM_FAILED, 'sub'],
    [
      'with a subject longer than a uid can be',
      () => ({ sub: 'u'.repeat(129) }),
      CLAIM_FAILED,
      'sub',
    ],
    ['with a subject that is not a string', () => ({ sub: 42 }), CLAIM_FAILED, 'sub'],
    ['without an issue time', () => ({ iat: undefined }), CLAIM_FAILED, 'iat'],
    ['issued in the future', () => ({ iat: later() }), CLAIM_FAILED, 'iat'],
    ['without an authentication time', () => ({ auth_time: undefined }), CLAIM_FAILED, 'auth_time'],
    ['authenticated in the future', () => ({ auth_time: later() }), CLAIM_FAILED, 'auth_time'],
    [
      'with an authentication time that is not a number',
      () => ({ auth_time: 'yesterday' }),
      CLAIM_FAILED,
      'auth_time',
    ],
    ['not valid until later', () => ({ nbf: later() }), CLAIM_FAILED, 'nbf'],
  ])('a token %s', async (_case, claims, code, claim) => {
    const check = await verifierOver()(await signer.sign(claims()));

    expect(check).toEqual({ ok: false, code, claim });
  });
});

describe('createIdTokenVerifier: a token not signed by one of the keys is refused', () => {
  it('a token signed by another key under a known kid', async () => {
    const check = await verifierOver()(await signer.sign({}, { withStrangerKey: true }));

    expect(check).toEqual({ ok: false, code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' });
  });

  it('a token naming a key the set does not hold', async () => {
    const check = await verifierOver()(await signer.sign({}, { header: { kid: 'unknown-kid' } }));

    expect(check).toEqual({ ok: false, code: 'ERR_JWKS_NO_MATCHING_KEY' });
  });

  it('a token naming no key at all, even when the set holds only one', async () => {
    const check = await verifierOver()(await signer.sign({}, { header: { kid: undefined } }));

    expect(check).toEqual({ ok: false, code: 'ERR_JWKS_NO_MATCHING_KEY' });
  });

  it('a token signed with a shared secret (HS256)', async () => {
    const token = await new SignJWT(defaultClaims())
      .setProtectedHeader({ alg: 'HS256', kid: TEST_KEY_ID })
      .sign(new TextEncoder().encode('a-secret-anyone-could-have-32-bytes'));

    const check = await verifierOver()(token);

    expect(check).toEqual({ ok: false, code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
  });

  it('a token signed with another RSA algorithm (RS512)', async () => {
    const { privateKey } = await generateKeyPair('RS512');
    const token = await new SignJWT(defaultClaims())
      .setProtectedHeader({ alg: 'RS512', kid: TEST_KEY_ID })
      .sign(privateKey);

    const check = await verifierOver()(token);

    expect(check).toEqual({ ok: false, code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
  });

  it('an unsigned token (alg none)', async () => {
    const check = await verifierOver()(new UnsecuredJWT(defaultClaims()).encode());

    expect(check).toEqual({ ok: false, code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
  });

  it('a token that is not a JWT', async () => {
    const check = await verifierOver()('not-base64.at-all.really');

    expect(check).toEqual({ ok: false, code: 'ERR_JWS_INVALID' });
  });
});

describe('createIdTokenVerifier: failing to get the keys is thrown, not a refusal', () => {
  it.each([
    ['the key set times out', () => new errors.JWKSTimeout()],
    ['the network fails', () => new TypeError('fetch failed')],
    [
      'Google answers something other than 200',
      () => new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    ],
    ['the answer is not a key set', () => new errors.JWKSInvalid('JSON Web Key Set malformed')],
    ['a key in the set is broken', () => new errors.JWKInvalid('Invalid JWK')],
  ])('when %s', async (_case, makeError) => {
    const failure = makeError();
    const keys = vi.fn<JWTVerifyGetKey>().mockRejectedValue(failure);

    await expect(verifierOver(keys)(await signer.sign())).rejects.toBe(failure);
    expect(keys).toHaveBeenCalledTimes(1);
  });
});

describe("createGoogleIdTokenKeys: Google's key set over HTTP (a fake fetch)", () => {
  const answering = (body: string, status = 200) =>
    vi
      .fn<FetchImplementation>()
      .mockImplementation(
        async () => new Response(body, { status, headers: { 'content-type': 'application/json' } }),
      );

  const timingOut = () =>
    vi
      .fn<FetchImplementation>()
      .mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));

  it("reads Google's securetoken JSON Web Key Set", () => {
    expect(FIREBASE_ID_TOKEN_KEYS_URL).toBe(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    );
  });

  it('fetches the set with a GET, verifies against it, and keeps it for the next token', async () => {
    const fetchKeys = answering(JSON.stringify(signer.jwks));
    const verify = verifierOver(createGoogleIdTokenKeys(fetchKeys));

    const first = await verify(await signer.sign());
    const second = await verify(await signer.sign({ sub: 'uid-grace' }));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    expect(fetchKeys).toHaveBeenCalledWith(
      FIREBASE_ID_TOKEN_KEYS_URL,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('refuses a token whose kid is not in the set it just fetched', async () => {
    const verify = verifierOver(createGoogleIdTokenKeys(answering(JSON.stringify(signer.jwks))));

    const check = await verify(await signer.sign({}, { header: { kid: 'rotated-away' } }));

    expect(check).toEqual({ ok: false, code: 'ERR_JWKS_NO_MATCHING_KEY' });
  });

  it.each([
    ['Google answers 502', () => answering('<html>502 Bad Gateway</html>', 502)],
    ['the answer is not JSON', () => answering('<html>maintenance</html>')],
    ['the answer is not a key set', () => answering('{"certs":[]}')],
    [
      'the network fails',
      () => vi.fn<FetchImplementation>().mockRejectedValue(new TypeError('fetch failed')),
    ],
    ['the request times out', timingOut],
  ])('throws when %s', async (_case, makeFetch) => {
    const verify = verifierOver(createGoogleIdTokenKeys(makeFetch()));

    await expect(verify(await signer.sign())).rejects.toBeInstanceOf(Error);
  });

  it('reports a timeout as jose does (ERR_JWKS_TIMEOUT)', async () => {
    const verify = verifierOver(createGoogleIdTokenKeys(timingOut()));

    await expect(verify(await signer.sign())).rejects.toMatchObject({ code: 'ERR_JWKS_TIMEOUT' });
  });
});

describe('googleIdTokenKeys', () => {
  it('is one key set for the whole server, and fetches nothing until a token is checked', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(googleIdTokenKeys()).toBe(googleIdTokenKeys());
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

describe('idTokenProjectId', () => {
  it("is the project when the server's and the browser's agree", () => {
    expect(idTokenProjectId('test-project', 'test-project')).toBe('test-project');
  });

  it('refuses different projects, naming the variables but not their values', () => {
    let thrown: unknown;
    try {
      idTokenProjectId('test-project', 'other-project');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FirebaseProjectMismatchError);
    const { message } = thrown as Error;
    expect(message).toMatch(/GCP_PROJECT_ID/);
    expect(message).toMatch(/NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
    expect(message).not.toMatch(/test-project|other-project/);
  });

  it('refuses a missing project id', () => {
    expect(() => idTokenProjectId('', '')).toThrow(/GCP_PROJECT_ID/);
  });
});
