import type { NextApiRequest } from 'next';

/**
 * Helper to extract the first value from a header (handles arrays and comma-separated strings)
 * @param value - Header value (string, string[], null, or undefined)
 * @returns First extracted value or undefined
 */
const first = (value: string | string[] | null | undefined): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value.split(',')[0]?.trim();
};

/**
 * Extracts the client IP address from a request with Cloudflare/Vercel support.
 * Priority order: CF-Connecting-IP → X-Real-IP → X-Forwarded-For → fallback to 127.0.0.1
 *
 * @param req - Next.js Request or NextApiRequest object
 * @returns The client IP address or '127.0.0.1' as fallback
 * @see https://developers.cloudflare.com/fundamentals/reference/http-headers/
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
 * @deprecated Use getClientIP instead. Kept for backwards compatibility.
 */
export default function getIP(request: Request | NextApiRequest): string | undefined {
  return getClientIP(request);
}
