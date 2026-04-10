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

import { Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_USERNAME = 'WomB0ComB0';

const LeetCodeStatsSchema = Schema.Struct({
  totalSolved: Schema.Number,
  easySolved: Schema.Number,
  mediumSolved: Schema.Number,
  hardSolved: Schema.Number,
  acceptanceRate: Schema.Number,
  ranking: Schema.Number,
});

export type LeetCodeStats = Schema.Schema.Type<typeof LeetCodeStatsSchema>;

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
let cache: { data: LeetCodeStats; timestamp: number } | null = null;

/**
 * Fetches LeetCode stats via the official GraphQL API.
 */
async function fetchFromGraphQL(): Promise<LeetCodeStats> {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        profile {
          ranking
        }
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com',
    },
    body: JSON.stringify({
      query,
      variables: { username: LEETCODE_USERNAME },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode GraphQL returned ${response.status}`);
  }

  const json = await response.json();
  const user = json?.data?.matchedUser;

  if (!user) {
    throw new Error('LeetCode user not found');
  }

  const submissions: { difficulty: string; count: number }[] =
    user.submitStatsGlobal.acSubmissionNum;
  const getCount = (diff: string) => submissions.find((s) => s.difficulty === diff)?.count ?? 0;

  const totalSolved = getCount('All');
  const easySolved = getCount('Easy');
  const mediumSolved = getCount('Medium');
  const hardSolved = getCount('Hard');
  const totalSubmissions = totalSolved > 0 ? totalSolved : 1;

  return {
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    acceptanceRate: Math.round((totalSolved / totalSubmissions) * 100 * 100) / 100,
    ranking: user.profile.ranking ?? 0,
  };
}

export async function getLeetCodeStats(): Promise<LeetCodeStats> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  try {
    const data = await fetchFromGraphQL();
    cache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    // Return stale cache if available rather than propagating a 503
    if (cache) {
      return cache.data;
    }
    throw ensureBaseError(error, 'leetcode:fetch');
  }
}
