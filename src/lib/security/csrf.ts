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

import { env } from '@/env';
import { nextCsrf } from 'next-csrf';
import * as _ from 'node:crypto';

/**
 * Initializes CSRF protection utilities using `next-csrf`.
 *
 * Provides:
 * - `setup`: Middleware to initialize CSRF protection on Next.js API routes.
 * - `csrf`: Middleware to verify CSRF tokens on requests.
 *
 * Configuration:
 * - Token is transmitted via 'x-csrf-token' header.
 * - Cookie is set as HTTP-only, secure (in production), and valid for 30 days.
 * - Secret is sourced from environment variable `CSRF_SECRET`.
 *
 * @constant
 * @readonly
 * @public
 * @web
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @see https://github.com/nktnet/next-csrf
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * import { setup, csrf } from '@/lib/security/csrf';
 * export default setup(handler);
 */
const { setup, csrf } = nextCsrf({
  tokenKey: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  },
  secret: env.CSRF_SECRET,
});

/**
 * Generates a cryptographically secure CSRF token using Node.js crypto.
 *
 * This token may be included in forms or headers to protect against cross-site request forgery attacks.
 *
 * @constant
 * @readonly
 * @public
 * @type {string}
 * @version 1.0.0
 * @author Mike Odnis (@WomB0ComB0)
 * @see https://nodejs.org/api/crypto.html#cryptorandombytes
 * @example
 * const token = csrfToken; // "14c1e45f8e7f4364a08..."
 */
const csrfToken = _.randomBytes(32).toString('hex');

export { csrf, csrfToken, setup };
