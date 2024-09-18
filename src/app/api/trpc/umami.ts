import { getAnalytics } from '@/lib/umami';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const resp = await getAnalytics();
  const analytics = await resp.json();

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json(analytics);
}
