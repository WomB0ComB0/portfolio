import 'server-only';

const query = `
  query UserPosts($username: String!, $page: Int!, $pageSize: Int!) {
    user(username: $username) {
      posts(page: $page, pageSize: $pageSize) {
        edges {
          node {
            title
            slug
            publishedAt
            brief
          }
        }
      }
    }
  }
`;

export interface Blog {
  title: string;
  slug: string;
  publishedAt: string;
  excerpt: string;
}

export async function getBlogs(username: string, page = 1, pageSize = 10): Promise<Blog[]> {
  const token = process.env.NEXT_PUBLIC_HASHNODE_TOKEN;
  const response = await fetch('https://gql.hashnode.com/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { username, page, pageSize },
    }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching blogs: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors.map((e: any) => e.message).join(', '));
  }

  const posts = data.data?.user?.posts?.edges || [];
  return posts.map((edge: any) => {
    const post = edge.node;
    return {
      title: post.title,
      slug: post.slug,
      publishedAt: post.publishedAt,
      excerpt: post.brief,
    };
  });
}
