/**
 * GitHub Sponsors route
 * Handles requests to fetch sponsor data from GitHub GraphQL API
 */

import { Elysia } from 'elysia';
import { getActiveSponsorsHandler, getGitHubSponsorsHandler } from './handlers';

export const githubSponsorsRoute = new Elysia()
  .get('/github-sponsors', async () => {
    return getGitHubSponsorsHandler();
  })
  .get('/github-sponsors/active', async () => {
    return getActiveSponsorsHandler();
  });
