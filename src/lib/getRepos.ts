import 'server-only';
import type { RepositoryEdge } from '@/generated/graphql';
import { env } from '@/env';

const getRepos = async (): Promise<RepositoryEdge[]> => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
				query viewer {
					viewer {
						repositories(first: 8, orderBy: {field: STARGAZERS, direction: DESC}) {
							edges {
								node {
									id
									name
									url
									description
									stargazers {
										totalCount
									}
									forkCount
									languages(first: 3) {
										nodes {
											id
											name
										}
									}
								}
							}
						}
					}
				}
			`,
    }),
    headers: {
      Authorization: `bearer ${env.GITHUB_TOKEN}`,
    },
  });

  const data: { data: { viewer: { repositories: { edges: RepositoryEdge[] } } } } =
    await res.json();

  return data?.data?.viewer?.repositories?.edges ?? [];
};

export default getRepos;
