import 'server-only';

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { cache } from 'react';
import { env } from '@/env';
import { post } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';

/**
 * @readonly
 * @description
 * Effect Schema definition for a repository's primary language.
 * @author Mike Odnis
 * @version 1.0.0
 * @private
 */
const PrimaryLanguageSchema = Schema.Struct({
  name: Schema.String,
});

/**
 * @readonly
 * @description
 * Effect Schema describing the structure for a pinned GitHub repository object.
 * Represents key repository data for portfolio display purposes.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 * @public
 */
export const PinnedRepoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.Union(Schema.String, Schema.Null),
  url: Schema.String,
  stargazerCount: Schema.Number,
  forkCount: Schema.Number,
  primaryLanguage: Schema.Union(PrimaryLanguageSchema, Schema.Null),
});

/**
 * TypeScript type representing a pinned GitHub repository as defined by {@link PinnedRepoSchema}.
 * @see PinnedRepoSchema
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 */
export type PinnedRepo = Schema.Schema.Type<typeof PinnedRepoSchema>;

/**
 * Fetches the pinned repositories of the user "WomB0ComB0" from the GitHub GraphQL API.
 *
 * Utilizes request-level caching for efficiency. Requests are authenticated using a GitHub token,
 * and schema validation is handled using Effect schemas.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<PinnedRepo[]>} Promise resolving to an array of pinned repositories.
 * @throws {Error} Throws if the fetch operation fails or the API returns an error.
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @see https://docs.github.com/en/graphql
 * @example
 * const repos = await getRepos();
 * repos.forEach(repo => console.log(repo.name, repo.url));
 */
export const getRepos = cache(async (): Promise<PinnedRepo[]> => {
  const effect = pipe(
    post(
      'https://api.github.com/graphql',
      {
        query: `
        query {
          user(login: "WomB0ComB0") {
            pinnedItems(first: 6, types: [REPOSITORY]) {
              edges {
                node {
                  ... on Repository {
                    name
                    description
                    url
                    stargazerCount
                    forkCount
                    primaryLanguage {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `,
      },
      {
        headers: {
          Authorization: `bearer ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        retries: 2,
        timeout: 10_000,
      },
    ),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const data: any = await Effect.runPromise(effect);
    return data.data.user.pinnedItems.edges.map((edge: any) => edge.node);
  } catch (error) {
    logger.error('Error fetching GitHub repos:', error);
    throw error;
  }
});

export default getRepos;
