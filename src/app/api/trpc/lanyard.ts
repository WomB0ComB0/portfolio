import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'experimental-edge',
};

type LanyardResponse = {
  discord_user: {
    username: string;
    discriminator: string;
    avatar: string;
    id: string;
  };
  discord_status: string;
};

export default async function handler(req: NextRequest) {
  const resp = await fetch('https://api.lanyard.rest/v1/users/${}');
  const response = await resp.json();
  const lanyard = response.data as LanyardResponse;

  return new Response(JSON.stringify(lanyard), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
