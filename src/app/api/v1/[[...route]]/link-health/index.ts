import { Elysia, t } from 'elysia';
import { after } from 'next/server';
import { readLinkHealth, refreshLinkHealth } from '@/lib/link-health/runtime';

const scope = t.Union([
  t.Literal('projects'),
  t.Literal('media'),
  t.Literal('certifications'),
  t.Literal('experience'),
]);

/** Fixed content collections only: this endpoint cannot check a supplied URL. */
export const linkHealthRoute = new Elysia({ prefix: '/link-health' }).get(
  '/',
  async ({ query, set }) => {
    const result = await readLinkHealth(query.scope);
    after(() => refreshLinkHealth(query.scope));
    set.headers['Cache-Control'] = 'public, max-age=0, s-maxage=30, stale-while-revalidate=30';
    return result;
  },
  { query: t.Object({ scope }) },
);
