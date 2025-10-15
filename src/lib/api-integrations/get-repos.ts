import 'server-only';

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { cache } from 'react';
import { env } from '@/env';
import { post } from '@/lib/http-clients/effect-fetcher';

const PrimaryLanguageSchema = Schema.Struct({
  name: Schema.String,
});

export const PinnedRepoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.Union(Schema.String, Schema.Null),
  url: Schema.String,
  stargazerCount: Schema.Number,
  forkCount: Schema.Number,
  primaryLanguage: Schema.Union(PrimaryLanguageSchema, Schema.Null),
});

export type PinnedRepo = Schema.Schema.Type<typeof PinnedRepoSchema>;

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
    console.error('Error fetching GitHub repos:', error);
    throw error;
  }
});

export default getRepos;
