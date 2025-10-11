import type { NextApiRequest } from 'next';
import z from 'zod';

export function parseIpFromHeaders(value: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value.split(',')[0];
}

/**
 * Tries to extract IP address from a request
 * @see https://github.com/vercel/examples/blob/main/edge-middleware/ip-blocking/lib/get-ip.ts
 **/
export default function getIP(request: Request | NextApiRequest): string | undefined {
  let xff =
    request instanceof Request
      ? request.headers.get('cf-connecting-ip')
      : request.headers['cf-connecting-ip'];

  if (xff === null) {
    xff =
      request instanceof Request ? request.headers.get('x-real-ip') : request.headers['x-real-ip'];
  }

  return xff ? parseIpFromHeaders(xff) : '127.0.0.1';
}

const banlistSchema = z.array(z.string());

export function isIpInBanlist(request: Request | NextApiRequest): boolean {
  const IP = getIP(request);
  // TODO: Use env
  const rawBanListJson = process.env.IP_BANLIST || '[]';
  const banList = banlistSchema.parse(JSON.parse(rawBanListJson));
  if (IP && banList.includes(IP)) {
    console.log(`Found banned IP: ${IP} in IP_BANLIST`);
    return true;
  }
  return false;
}

export function isIpInBanListString(identifer: string): boolean {
  // TODO: Use env
  const rawBanListJson = process.env.IP_BANLIST || '[]';
  const banList = banlistSchema.parse(JSON.parse(rawBanListJson));
  if (banList.includes(identifer)) {
    console.log(`Found banned IP: ${identifer} in IP_BANLIST`);
    return true;
  }
  return false;
}
