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
 * @file Verifying a Firebase ID token on the server with jose, by the rules Firebase documents for
 * doing it without the Admin SDK
 * (https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library):
 * - the header: alg RS256 only, and a kid naming one of Google's securetoken keys;
 * - the signature: by that key, from {@link FIREBASE_ID_TOKEN_KEYS_URL} (the same keys as the x509
 *   certificates Firebase lists, as a JSON Web Key Set);
 * - the claims: aud is the project id (exactly, not a list), iss is
 *   https://securetoken.google.com/<project id>, exp in the future, iat and auth_time in the past,
 *   sub a non-empty string of at most 128 characters (the uid). A clock skew of
 *   {@link ID_TOKEN_CLOCK_TOLERANCE_SECONDS} is allowed on the times.
 *
 * Why not firebase-admin's auth entry: Next loads firebase-admin at runtime, outside the bundle,
 * and that entry require()s jose (an ES module) through jwks-rsa, which a Node without
 * require(esm) cannot do. #616 used it, and every /api/v1 route failed to load. jose imported here
 * is bundled into the route like any other dependency, so nothing is require()d at runtime.
 *
 * A token that breaks a rule is refused (`ok: false`, with jose's code and the claim at fault, both
 * safe to log): the caller answers 401. A failure to get the keys (Google unreachable, slow, or
 * answering something that is not a key set) is thrown, as is anything unexpected: the caller
 * answers 500 and reports it, rather than signing a valid visitor out.
 *
 * The revocation check (an Auth backend call per token) is not made: ID tokens live an hour.
 */

import 'server-only';
import {
  createRemoteJWKSet,
  customFetch,
  errors,
  type FetchImplementation,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  jwtVerify,
} from 'jose';

/** Google's public keys for Firebase ID tokens, as a JSON Web Key Set. */
export const FIREBASE_ID_TOKEN_KEYS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Every ID token for a project names this issuer, followed by the project id. */
const ISSUER_PREFIX = 'https://securetoken.google.com/';

/** How far the server's clock may be from Google's, in seconds, for exp, iat and auth_time. */
export const ID_TOKEN_CLOCK_TOLERANCE_SECONDS = 10;

/** How long to wait for Google's keys before giving up (a reported 500, not a refusal). */
const KEYS_TIMEOUT_MS = 5_000;

/** Firebase uids are at most 128 characters. */
const MAX_UID_LENGTH = 128;

/** jose's codes for a token that is not acceptable. Any other failure is the server's. */
const REFUSED_TOKEN_CODES: ReadonlySet<string> = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
]);

const CLAIM_FAILED = 'ERR_JWT_CLAIM_VALIDATION_FAILED';

/** Where to get the key a token names: Google's set, or a local one in tests. */
export type IdTokenKeys = JWTVerifyGetKey;

/** A verified token's claims, as signed, with the uid (its subject) alongside. */
export interface FirebaseIdToken extends JWTPayload {
  readonly uid: string;
  readonly name?: unknown;
  readonly firebase?: { readonly sign_in_provider?: unknown };
}

/** Why a token was refused: jose's error code, and the claim at fault when there is one. */
export interface IdTokenRefusal {
  readonly ok: false;
  readonly code: string;
  readonly claim?: string;
}

export type IdTokenCheck = { readonly ok: true; readonly token: FirebaseIdToken } | IdTokenRefusal;

/** Checks one token: resolves with the verdict, rejects only for a server-side failure. */
export type IdTokenVerifier = (token: string) => Promise<IdTokenCheck>;

export interface IdTokenVerifierOptions {
  /** The Firebase project the tokens must be for. */
  readonly projectId: string;
  /** The keys to check signatures with: {@link googleIdTokenKeys} on the server. */
  readonly keys: IdTokenKeys;
}

const refused = (code: string, claim?: string): IdTokenRefusal =>
  claim === undefined ? { ok: false, code } : { ok: false, code, claim };

/** The refusal a jose error stands for, or null when it is not about the token. */
const refusalOf = (error: unknown): IdTokenRefusal | null => {
  if (!(error instanceof errors.JOSEError) || !REFUSED_TOKEN_CODES.has(error.code)) return null;
  const claim: unknown = (error as { claim?: unknown }).claim;
  return refused(error.code, typeof claim === 'string' ? claim : undefined);
};

/** jose picks the only key of a set when a token names none; Firebase's tokens always name one. */
const requireKeyId =
  (keys: IdTokenKeys): IdTokenKeys =>
  (header, token) => {
    if (typeof header.kid !== 'string' || header.kid.length === 0) {
      throw new errors.JWKSNoMatchingKey('The token names no key (kid)');
    }
    return keys(header, token);
  };

/** The claim that breaks one of Firebase's rules jose does not check itself, or null. */
const firebaseClaimProblem = (payload: JWTPayload, projectId: string): string | null => {
  const latest = Math.floor(Date.now() / 1000) + ID_TOKEN_CLOCK_TOLERANCE_SECONDS;
  const authTime: unknown = payload.auth_time;
  // jose accepts a list of audiences that includes the project; Firebase's aud is the project.
  if (payload.aud !== projectId) return 'aud';
  if (typeof payload.iat !== 'number' || payload.iat > latest) return 'iat';
  if (typeof authTime !== 'number' || authTime > latest) return 'auth_time';
  return null;
};

const isUid = (sub: unknown): sub is string =>
  typeof sub === 'string' && sub.length > 0 && sub.length <= MAX_UID_LENGTH;

/** A verifier for `projectId`'s ID tokens against `keys`. */
export function createIdTokenVerifier({
  projectId,
  keys,
}: IdTokenVerifierOptions): IdTokenVerifier {
  if (!projectId) throw new TypeError('A Firebase project id is needed to verify ID tokens');
  const getKey = requireKeyId(keys);
  const verifyOptions: JWTVerifyOptions = {
    algorithms: ['RS256'],
    issuer: `${ISSUER_PREFIX}${projectId}`,
    audience: projectId,
    clockTolerance: ID_TOKEN_CLOCK_TOLERANCE_SECONDS,
    requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
  };

  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, getKey, verifyOptions));
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal) return refusal;
      throw error;
    }
    const claim = firebaseClaimProblem(payload, projectId);
    if (claim) return refused(CLAIM_FAILED, claim);
    const { sub } = payload;
    if (!isUid(sub)) return refused(CLAIM_FAILED, 'sub');
    return { ok: true, token: Object.freeze({ ...payload, uid: sub }) };
  };
}

/**
 * Google's key set over HTTP: fetched on first use, kept for jose's default 10 minutes, and
 * fetched again early (at most every 30 s) when a token names a key it does not hold. `fetchKeys`
 * replaces fetch, for tests.
 */
export function createGoogleIdTokenKeys(fetchKeys?: FetchImplementation): IdTokenKeys {
  return createRemoteJWKSet(new URL(FIREBASE_ID_TOKEN_KEYS_URL), {
    timeoutDuration: KEYS_TIMEOUT_MS,
    ...(fetchKeys ? { [customFetch]: fetchKeys } : {}),
  });
}

let googleKeys: IdTokenKeys | null = null;

/** The server's one copy of Google's key set (made on first use; nothing is fetched until then). */
export function googleIdTokenKeys(): IdTokenKeys {
  googleKeys ??= createGoogleIdTokenKeys();
  return googleKeys;
}

/**
 * The server's Firebase project (GCP_PROJECT_ID, where the guestbook is written) and the browser's
 * (NEXT_PUBLIC_FIREBASE_PROJECT_ID, which signs visitors in) differ, so no visitor's token is for
 * the project their message would be stored in. The message names the variables, never their
 * values.
 */
export class FirebaseProjectMismatchError extends Error {
  readonly name = 'FirebaseProjectMismatchError';

  constructor() {
    super(
      "GCP_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID name different Firebase projects, so visitors' sign-in tokens cannot be verified",
    );
  }
}

/**
 * The project ID tokens must be for: the server's, when it is the browser's. Throws (a reported
 * 500) when they differ or the server's is missing, rather than refusing every visitor with a 401.
 */
export function idTokenProjectId(serverProjectId: string, browserProjectId: string): string {
  if (!serverProjectId) {
    throw new TypeError('GCP_PROJECT_ID is not set, so sign-in tokens cannot be verified');
  }
  if (serverProjectId !== browserProjectId) throw new FirebaseProjectMismatchError();
  return serverProjectId;
}
