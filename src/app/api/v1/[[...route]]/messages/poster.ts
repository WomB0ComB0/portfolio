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
 * `Authorization: Bearer <token>` and verified (src/core/firebase-id-token.ts, with jose) before
 * anything is written.
 *
 * - A missing header, or one that is not a single JWT-shaped bearer token (at most
 *   {@link MAX_TOKEN_LENGTH} characters), is refused without checking it.
 * - The token is checked locally, by Firebase's documented rules: an RS256 signature by one of
 *   Google's securetoken keys (fetched on first use and cached), for this project (aud and iss),
 *   not expired, issued and authenticated in the past, with a uid. The project is GCP_PROJECT_ID,
 *   which must be the browser's NEXT_PUBLIC_FIREBASE_PROJECT_ID. There is no revocation lookup: it
 *   would be a call to the Auth backend on every post, while ID tokens live an hour and posts are
 *   rate limited.
 * - A token that breaks a rule (invalid, expired, another project, a key Google does not publish)
 *   is a 'rejected' poster: the route answers 401 and logs jose's error code and the claim at
 *   fault, and nothing else, as an error (the production log level drops warnings; the guestbook
 *   limiter bounds how many there can be).
 * - Any other failure is thrown, so the route answers a 500 and reports it: the server's project
 *   missing or not the browser's, or Google's keys that cannot be fetched (unreachable, slow, or
 *   an answer that is not a key set). A 401 would make the browser sign a valid visitor out.
 * - The poster is the token's uid, and the name the sign-in carries, checked like typed text
 *   (checkAuthorName), but only for the providers the site offers with a name (Google, GitHub). A
 *   guest (anonymous sign-in), and a sign-in the site does not offer (email and password, phone, a
 *   custom token: possible with the public web config if the project enables them), always posts
 *   as 'Anonymous'. A name sent in the request body is never used. The name is the visitor's own
 *   Firebase profile name, which they can change, so it says who they say they are; the uid is
 *   what identifies them.
 * - Accepting guests is deliberate, and anyone can get a guest token with the public web config:
 *   this check gives each post a uid to moderate by, not spam resistance. The per-IP 'guestbook'
 *   limiter (src/lib/security/api-guard.ts) is the flood control; a per-uid limit would add
 *   nothing to it, since a guest uid costs nothing to make.
 */

import {
  createIdTokenVerifier,
  type FirebaseIdToken,
  googleIdTokenKeys,
  idTokenProjectId,
} from '@/core/firebase-id-token';
import { env } from '@/env';
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
export function posterOf(token: FirebaseIdToken): Poster {
  const provider: unknown = token.firebase?.sign_in_provider;
  const isNamed = typeof provider === 'string' && NAMED_PROVIDERS.has(provider);
  const name: unknown = isNamed ? token.name : null;
  return {
    uid: token.uid,
    authorName: checkAuthorName(typeof name === 'string' ? name : null),
  };
}

/**
 * The poster for a request's Authorization header, or why there is none. Rejects only when the
 * token could not be checked for a server-side reason (the projects differ, Google's keys cannot
 * be fetched).
 */
export async function verifyPoster(authorization: string | undefined): Promise<PosterCheck> {
  if (!authorization) return { ok: false, reason: 'missing' };
  const token = bearerTokenOf(authorization);
  if (!token) return { ok: false, reason: 'malformed' };

  const verify = createIdTokenVerifier({
    projectId: idTokenProjectId(env.GCP_PROJECT_ID, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    keys: googleIdTokenKeys(),
  });
  const check = await verify(token);
  if (check.ok) return { ok: true, poster: posterOf(check.token) };

  log.error('Guestbook post refused: the sign-in token was rejected', undefined, {
    code: check.code,
    ...(check.claim === undefined ? {} : { claim: check.claim }),
  });
  return { ok: false, reason: 'rejected' };
}
