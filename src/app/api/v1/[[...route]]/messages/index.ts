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
 * @file POST /api/v1/messages: signing the guestbook. There is no GET: the /guestbook page lists
 * the messages on the server.
 *
 * Checks, cheapest first, and nothing is written until all of them pass:
 * 1. the API guard (createElysiaApp's onRequest, before routing): bans, and the 'guestbook' rate
 *    limiter, which counts every POST, signed in or not;
 * 2. the body schema (./schema.ts): a message of 1 to 280 characters, else 400;
 * 3. the sign-in (./poster.ts): `Authorization: Bearer <Firebase ID token>`, verified with the
 *    Admin SDK, else 401 with one fixed body and a WWW-Authenticate challenge;
 * 4. the text itself (createMessage): nothing postable left once markup is removed, else 400.
 * Then the message is stored once, under the poster's name (their uid in a server-only document
 * with the same id, written in the same batch), and answered 201.
 */

import { Elysia, StatusMap } from 'elysia';
import { createMessage, InvalidMessageError } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { type PosterRefusal, verifyPoster } from './poster';
import { messagesSchema } from './schema';

/** The 401 body: the same for a missing, malformed, invalid or expired token. */
export const SIGN_IN_REQUIRED = {
  error: 'Sign in to post a message. Your sign-in is missing or has expired.',
} as const;

const CHALLENGE = 'Bearer realm="guestbook"';

/** RFC 6750: no error code when no token was sent, invalid_token when one was refused. */
const challengeFor = (reason: PosterRefusal): string =>
  reason === 'missing' ? CHALLENGE : `${CHALLENGE}, error="invalid_token"`;

export const messagesRoute = new Elysia({ prefix: '/messages' }).model(messagesSchema).post(
  '/',
  async ({ body, headers, set }) => {
    try {
      const check = await verifyPoster(headers.authorization);
      if (!check.ok) {
        set.status = StatusMap.Unauthorized;
        set.headers['www-authenticate'] = challengeFor(check.reason);
        set.headers['cache-control'] = 'no-store';
        return SIGN_IN_REQUIRED;
      }
      const newMessage = await createMessage(body, check.poster);
      set.status = StatusMap.Created;
      Object.assign(set.headers, cacheHeaders());
      return newMessage;
    } catch (error) {
      // The visitor's text, not the server: answered, not reported.
      if (error instanceof InvalidMessageError) {
        set.status = StatusMap['Bad Request'];
        return { error: 'The message is empty once markup is removed, or too long.' };
      }
      const errorResponse = errorHandler(error);
      set.status = StatusMap['Internal Server Error'];
      return { error: errorResponse.error };
    }
  },
  {
    body: 'messages.post.body',
    response: {
      201: 'messages.post.response',
      400: 'messages.error',
      401: 'messages.error',
      500: 'messages.error',
    },
  },
);
