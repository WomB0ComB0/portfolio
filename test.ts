import fetch from 'node-fetch';

const fetchUserPosts = async (username: string, page = 1, pageSize = 10) => {
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

  const token = process.env.NEXT_PUBLIC_HASHNODE_TOKEN;
  const url = 'https://gql.hashnode.com/';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { username, page, pageSize },
      }),
    });

    if (!response.ok) {
      throw new Error(`Error fetching user posts: ${response.statusText}`);
    }

    const responseBody: any = await response.json();

    if (responseBody.errors) {
      throw new Error(responseBody.errors.map((e: { message: string }) => e.message).join(', '));
    }

    const posts = responseBody.data?.user?.posts?.edges || [];
    return posts.map(
      (edge: { node: { title: string; slug: string; publishedAt: string; brief: string } }) => {
        const post = edge.node;
        return {
          title: post.title,
          slug: post.slug,
          publishedAt: post.publishedAt,
          excerpt: post.brief,
        };
      },
    );
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw error;
  }
};

// Example usage
fetchUserPosts('WomB0ComB0', 1)
  .then((posts) => {
    posts.forEach((post: { title: string; publishedAt: string; slug: string; excerpt: string }) => {
      console.log('Title:', post.title);
      console.log('Published Date:', post.publishedAt);
      console.log('Slug:', post.slug);
      console.log('Excerpt:', post.excerpt);
      console.log('-----------------------------');
    });
    console.log('Fetched posts successfully.');
  })
  .catch((error) => {
    console.error('Failed to fetch posts:', error);
  });
