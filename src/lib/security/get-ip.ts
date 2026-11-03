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

import type { NextApiRequest } from 'next';

/**
 * Extracts the first value from a header value, handling arrays and comma-separated lists.
 *
 * @function
 * @private
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 * @param {string | string[] | null | undefined} value - Header value to extract from. Can be a string, array, null or undefined.
 * @returns {string | undefined} The first value found, or undefined if not present.
 * @example
 * first("123, 456"); // "123"
 * first(["abc", "def"]); // "abc"
 */
const first = (value: string | string[] | null | undefined): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value.split(',')[0]?.trim();
};

/**
 * Retrieves the originating client IP address from a request.
 * Priority order: X-Real-IP → X-Vercel-Forwarded-For → first X-Forwarded-For entry → 127.0.0.1.
 *
 * Only headers set by the hosting layer are trusted: Vercel (and the repo's nginx config) set
 * X-Real-IP to the connecting client and overwrite X-Forwarded-For. CF-Connecting-IP is ignored on
 * purpose: the site is not behind Cloudflare, so any client could send it to pose as another IP
 * (for example 127.0.0.1, which the ban checks skip). If Cloudflare is ever put in front of the
 * site, X-Real-IP becomes Cloudflare's egress IP and this needs revisiting.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.1.0
 * @param {Request | NextApiRequest} req - The incoming request object (native Fetch API Request or NextApiRequest).
 * @returns {string} The detected client IP address, or '127.0.0.1' if none found.
 * @throws {Error} May throw if header parsing fails unexpectedly.
 * @example
 * getClientIP(req); // "203.0.113.42"
 * @see https://vercel.com/docs/edge-network/headers
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
 * @see https://github.com/WomB0ComB0/portfolio
 */
export function getClientIP(req: Request | NextApiRequest): string {
  const headers =
    req instanceof Request ? Object.fromEntries(req.headers) : (req.headers as Record<string, any>);

  // Set by Vercel and the nginx config to the connecting client
  const xr = first(headers['x-real-ip'] || headers['X-Real-IP']);
  if (xr) return xr;

  // Vercel-only, robust even behind another proxy
  const xv = first(headers['x-vercel-forwarded-for'] || headers['X-Vercel-Forwarded-For']);
  if (xv) return xv;

  // Standard proxy chain header (get first IP in chain)
  const xff = first(headers['x-forwarded-for'] || headers['X-Forwarded-For']);
  if (xff) return xff;

  return '127.0.0.1';
}

/**
 * @deprecated since 1.1.0 Use {@link getClientIP} instead. Kept for backwards compatibility.
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 * @param {Request | NextApiRequest} request - The incoming request object.
 * @returns {string | undefined} The client IP address.
 * @see getClientIP
 * @see https://github.com/WomB0ComB0/portfolio
 */
export default function getIP(request: Request | NextApiRequest): string | undefined {
  return getClientIP(request);
}
