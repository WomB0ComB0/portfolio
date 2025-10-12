import axios from 'axios';

interface DiscordUser {
  username: string;
  discriminator: string;
  avatar: string;
  id: string;
}

interface Activity {
  name: string;
  type: number;
  state?: string;
  details?: string;
}

interface LanyardData {
  discord_user: DiscordUser;
  activities: Activity[];
  discord_status: string;
}

const CACHE_DURATION = 60 * 1000;
let cache: { data: LanyardData; timestamp: number } | null = null;

export async function getLanyardData(): Promise<LanyardData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const resp = await axios.get(
    `https://api.lanyard.rest/v1/users/${process.env.NEXT_PUBLIC_DISCORD_ID}`,
  );

  if (resp.status !== 200) {
    throw new Error(`Lanyard API responded with status ${resp.status}`);
  }

  const lanyard: LanyardData = resp.data.data;
  cache = { data: lanyard, timestamp: Date.now() };

  return lanyard;
}
