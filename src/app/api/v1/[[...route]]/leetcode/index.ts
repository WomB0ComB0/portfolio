import { Elysia } from 'elysia';
import { getLeetCodeStats } from './handlers';

export const leetCodeStatsRoute = new Elysia({ prefix: '/leetcode' }).get('/', async () => {
  try {
    const data = await getLeetCodeStats();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch LeetCode stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
