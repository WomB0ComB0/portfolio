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
 * Retrieves the originating client IP address from a request, supporting various cloud and proxy headers.
 * Priority order: CF-Connecting-IP → X-Real-IP → X-Forwarded-For → fallback to 127.0.0.1.
 *
 * Handles requests originating from Cloudflare, Vercel, or other reverse proxies by parsing the corresponding HTTP headers.
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
 * @see https://developers.cloudflare.com/fundamentals/reference/http-headers/
 * @see https://vercel.com/docs/edge-network/headers
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
 * @see https://github.com/WomB0ComB0/portfolio
 */
export function getClientIP(req: Request | NextApiRequest): string {
  const headers =
    req instanceof Request ? Object.fromEntries(req.headers) : (req.headers as Record<string, any>);

  // Cloudflare sets this when traffic passes through CF (preferred)
  const cf = first(headers['cf-connecting-ip'] || headers['CF-Connecting-IP']);
  if (cf) return cf;

  // Common reverse proxy header
  const xr = first(headers['x-real-ip'] || headers['X-Real-IP']);
  if (xr) return xr;

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
