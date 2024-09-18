import getRepos from '@/lib/getRepos';
import Repository from '../github/Repository';
const Projects = async () => {
  const data = await getRepos();

  return (
    <div className="container py-8" id="projects">
      <h2 className="mb-6 text-2xl font-bold">Projects</h2>
      <div className="grid grid-cols-1 col-span-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:col-span-2 lg:col-span-3">
        {data
          ? data.map(({ node }) => {
              if (!node) return null;
              return <Repository key={node.id} {...node} />;
            })
          : null}
      </div>
    </div>
  );
};

export default Projects;
