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
 * @file Who is signing the guestbook: the visitor's Firebase ID token, sent as
 * `Authorization: Bearer <token>` and verified with the Admin SDK before anything is written.
 *
 * - A missing header, or one that is not a single JWT-shaped bearer token (at most
 *   {@link MAX_TOKEN_LENGTH} characters), is refused without calling Firebase.
 * - verifyIdToken checks the signature against Google's public certificates (fetched once and
 *   cached by the SDK), the project, the issuer and the expiry. The revocation lookup
 *   (checkRevoked) is not used: it is a call to the Auth backend on every post and needs the
 *   service-account credential, while ID tokens live an hour and posts are rate limited.
 * - A token Firebase rejects (invalid, expired, revoked, disabled account) is a 'rejected' poster:
 *   the route answers 401 and logs Firebase's error code, and nothing else, as an error (the
 *   production log level drops warnings; the guestbook limiter bounds how many there can be).
 * - Any other failure (no project id, the Admin project not the browser's one, an SDK fault) is
 *   thrown, so the route answers a 500 and reports it. That includes a failure to fetch Google's
 *   certificates: firebase-admin reports it as auth/argument-error, the code of a bad token, so it
 *   is told apart by the SDK's wording ({@link CERT_FETCH_FAILURE}). A 401 would make the browser
 *   sign a valid visitor out; any wording not matched still gets the 401.
 * - The poster is the token's uid, and the name the sign-in carries, checked like typed text
 *   (checkAuthorName), but only for the providers the site offers with a name (Google, GitHub). A
 *   guest (anonymous sign-in), and a sign-in the site does not offer (email and password, phone, a
 *   custom token: possible with the public web config if the project enables them), always posts
 *   as 'Anonymous'. A name sent in the request body is never used. The name is the visitor's own
 *   Firebase profile name, which they can change, so it says who they say they are; the uid is
 *   what identifies them.
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/core/firebase-admin';
import { checkAuthorName } from '@/lib/guestbook/text';
import { Logger } from '@/utils';

const log = Logger.getLogger('GuestbookPoster');

/** Firebase ID tokens are about 1 kB; anything far longer is not one. */
export const MAX_TOKEN_LENGTH = 4_096;

const BEARER = /^Bearer +(\S+) *$/i;
/** Three base64url parts: the shape of a JWT. */
const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;
/** The longest Authorization header worth matching: the scheme, a space and the longest token. */
const MAX_HEADER_LENGTH = MAX_TOKEN_LENGTH + 16;

/** The sign-in methods the site offers whose name a message is shown under. */
const NAMED_PROVIDERS: ReadonlySet<string> = new Set(['google.com', 'github.com']);

/** Firebase's codes for a token that is not acceptable. Anything else is a server-side failure. */
const REJECTED_TOKEN_CODES: ReadonlySet<string> = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/** A verified visitor: who to store the message under. */
export interface Poster {
  /** Firebase uid, for moderation: kept server-side, not on the public message, never sent back. */
  readonly uid: string;
  /** The name the message is shown under. */
  readonly authorName: string;
}

/** Why a request has no poster: no header, a header that is not a bearer JWT, or a refused token. */
export type PosterRefusal = 'missing' | 'malformed' | 'rejected';

export type PosterCheck =
  | { readonly ok: true; readonly poster: Poster }
  | { readonly ok: false; readonly reason: PosterRefusal };

/** The bearer token in an Authorization header, or null when the header is not one. */
export function bearerTokenOf(header: string): string | null {
  if (header.length > MAX_HEADER_LENGTH) return null;
  const token = BEARER.exec(header)?.[1];
  if (!token || token.length > MAX_TOKEN_LENGTH || !JWT_SHAPE.test(token)) return null;
  return token;
}

/** The poster a verified token names: its name only for a provider in {@link NAMED_PROVIDERS}. */
export function posterOf(token: DecodedIdToken): Poster {
  const provider: unknown = token.firebase?.sign_in_provider;
  const isNamed = typeof provider === 'string' && NAMED_PROVIDERS.has(provider);
  const name: unknown = isNamed ? token.name : null;
  return {
    uid: token.uid,
    authorName: checkAuthorName(typeof name === 'string' ? name : null),
  };
}

/**
 * How firebase-admin words a failure to fetch Google's public certificates (a network error, or an
 * answer that is not the certificates). It reports those as auth/argument-error, like a bad token.
 */
const CERT_FETCH_FAILURE = /^Error (?:while making request|fetching public keys)\b/;

const codeOf = (error: unknown): unknown => (error as { code?: unknown } | null)?.code;
const messageOf = (error: unknown): unknown => (error as { message?: unknown } | null)?.message;

const isCertFetchFailure = (error: unknown): boolean => {
  const message = messageOf(error);
  return typeof message === 'string' && CERT_FETCH_FAILURE.test(message);
};

const isRejectedToken = (error: unknown): boolean => {
  const code = codeOf(error);
  return typeof code === 'string' && REJECTED_TOKEN_CODES.has(code) && !isCertFetchFailure(error);
};

/**
 * The poster for a request's Authorization header, or why there is none. Rejects only when the
 * token could not be checked for a server-side reason.
 */
export async function verifyPoster(authorization: string | undefined): Promise<PosterCheck> {
  if (!authorization) return { ok: false, reason: 'missing' };
  const token = bearerTokenOf(authorization);
  if (!token) return { ok: false, reason: 'malformed' };
  try {
    return { ok: true, poster: posterOf(await getAdminAuth().verifyIdToken(token)) };
  } catch (error) {
    if (!isRejectedToken(error)) throw error;
    log.error('Guestbook post refused: the sign-in token was rejected', undefined, {
      code: codeOf(error),
    });
    return { ok: false, reason: 'rejected' };
  }
}
