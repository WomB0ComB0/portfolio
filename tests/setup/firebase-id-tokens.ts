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
 * @file Firebase-shaped ID tokens for tests, signed with RSA keys generated here on every run.
 * Nothing here is a real token or key, and nothing calls Google or Firebase: the key set is a
 * local one (createLocalJWKSet), standing in for Google's securetoken keys.
 */

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type JWTHeaderParameters,
  type JWTPayload,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';

/** The synthetic Firebase project every test token is for, unless a test says otherwise. */
export const TEST_PROJECT_ID = 'test-project';

/** The key id the local key set publishes. */
export const TEST_KEY_ID = 'test-key-1';

/** Claims to put in a token; a claim given as undefined is left out of it. */
export type TestClaims = Readonly<Record<string, unknown>>;

export interface SignOptions {
  /** Header fields over the defaults (alg RS256, the local key's kid); undefined drops one. */
  readonly header?: Readonly<Record<string, unknown>>;
  /** Sign with a key the local key set does not hold (same kid), so the signature cannot match. */
  readonly withStrangerKey?: boolean;
}

export interface IdTokenSigner {
  /** The public half, as Google publishes its keys (a JSON Web Key Set). */
  readonly jwks: JSONWebKeySet;
  /** The key set to verify against, as the server's would be (createLocalJWKSet over {@link jwks}). */
  readonly keys: JWTVerifyGetKey;
  /** A token like Firebase issues after a Google sign-in, with `claims` over the defaults. */
  sign(claims?: TestClaims, options?: SignOptions): Promise<string>;
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/** What a fresh Firebase ID token for a Google sign-in carries (synthetic values). */
export const defaultClaims = (projectId: string = TEST_PROJECT_ID): JWTPayload => {
  const now = nowInSeconds();
  return {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: 'uid-ada',
    iat: now - 60,
    exp: now + 3_540,
    auth_time: now - 120,
    name: 'Ada Lovelace',
    firebase: { sign_in_provider: 'google.com', identities: {} },
  };
};

const withoutUndefined = (record: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

/** A fresh RSA key pair and a signer for tokens over it (and over a stranger key with the same kid). */
export async function createIdTokenSigner(
  projectId: string = TEST_PROJECT_ID,
): Promise<IdTokenSigner> {
  const own = await generateKeyPair('RS256', { extractable: true });
  const stranger = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(own.publicKey);
  const jwks: JSONWebKeySet = {
    keys: [{ ...publicJwk, kid: TEST_KEY_ID, alg: 'RS256', use: 'sig' }],
  };

  return {
    jwks,
    keys: createLocalJWKSet(jwks),
    sign: (claims = {}, options = {}) => {
      const payload = withoutUndefined({ ...defaultClaims(projectId), ...claims });
      const header = withoutUndefined({ alg: 'RS256', kid: TEST_KEY_ID, ...options.header });
      return new SignJWT(payload)
        .setProtectedHeader(header as unknown as JWTHeaderParameters)
        .sign(options.withStrangerKey ? stranger.privateKey : own.privateKey);
    },
  };
}
