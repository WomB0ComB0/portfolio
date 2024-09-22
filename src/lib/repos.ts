import axios from 'axios';

export async function getPinnedRepos() {
  const res = await axios.get(
    'https://api.github.com/users/WomB0ComB0/repos',
  );
  const repos = res.data;

  return repos.map((repo: any) => {
    return {
      name: repo.name,
      description: repo.description,
      url: repo.link,
      stars: repo.stars,
      forks: repo.forks,
    };
  });
}
