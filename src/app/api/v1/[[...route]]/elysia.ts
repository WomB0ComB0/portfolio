import { Elysia } from 'elysia';
import { blogRoute } from './blog';
import { githubStatsRoute } from './github-stats';
import { googleRoute } from './google';
import { lanyardRoute } from './lanyard';
import { messagesRoute } from './messages';
import { nowPlayingRoute } from './now-playing';
import { sanityRoutes } from './sanity';
import { topArtistsRoute } from './top-artists';
import { topTracksRoute } from './top-tracks';
import { wakatimeRoute } from './wakatime';

/**
 * API routes for all endpoints.
 * Includes:
 *   - /now-playing (Spotify)
 *   - /lanyard (Discord)
 *   - /wakatime
 *   - /github-stats
 *   - /google (Analytics)
 *   - /top-artists (Spotify)
 *   - /top-tracks (Spotify)
 *   - /blog
 *   - /messages (GET and POST)
 *   - /sanity/* (CMS content)
 * @type {Elysia}
 */
export const apiRoutes = new Elysia()
  .use(nowPlayingRoute)
  .use(lanyardRoute)
  .use(wakatimeRoute)
  .use(githubStatsRoute)
  .use(googleRoute)
  .use(topArtistsRoute)
  .use(topTracksRoute)
  .use(blogRoute)
  .use(messagesRoute)
  .use(sanityRoutes);

// Debug logging
console.log('[ELYSIA DEBUG] Blog route type:', typeof blogRoute);
console.log('[ELYSIA DEBUG] Blog route instance:', blogRoute instanceof Elysia);
console.log('[ELYSIA DEBUG] Blog route keys:', Object.keys(blogRoute));

export { utilityRoutes } from './utility';
