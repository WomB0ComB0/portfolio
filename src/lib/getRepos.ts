import 'server-only';

export interface PinnedRepo {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: {
    name: string;
  } | null;
}

const getRepos = async (): Promise<PinnedRepo[]> => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({
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
    }),
    headers: {
      Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
    },
  });

  const data = await res.json();
  return data.data.user.pinnedItems.edges.map((edge: any) => edge.node);
};

export default getRepos;
