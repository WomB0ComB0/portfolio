
import type { Repository as RepositoryType } from '@/generated/graphql';
import { GitFork, StarIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * @function Repository
 * @description React component rendering a GitHub repository card with details including name, description, star and fork counts, and primary languages.
 * @param {RepositoryType} props - The repository properties.
 * @param {string} props.name - Name of the repository.
 * @param {string | null | undefined} props.description - Repository description.
 * @param {{ totalCount: number }} props.stargazers - Stargazer statistics.
 * @param {number} props.forkCount - Count of repository forks.
 * @param {{ nodes: Array<{ id?: string | null; name?: string | null }> } | null | undefined} props.languages - Languages associated with the repository.
 * @param {string} props.url - External URL to the GitHub repository.
 * @returns {JSX.Element} The rendered repository link card component.
 * @throws {Error} Throws if required fields such as `name` or `url` are missing.
 * @example
 * <Repository
 *   name="portfolio"
 *   description="My portfolio project"
 *   stargazers={{ totalCount: 12 }}
 *   forkCount={3}
 *   languages={{ nodes: [{ id: '1', name: 'TypeScript' }] }}
 *   url="https://github.com/WomB0ComB0/portfolio"
 * />
 * @web
 * @public
 * @author Mike Odnis
 * @see https://nextjs.org/docs/api-reference/next/link
 * @see https://lucide.dev/icons/
 * @version 1.0.0
 * @module src/app/(routes)/(main)/projects/_components/repository
 */
const Repository = ({
  name,
  description,
  stargazers,
  forkCount,
  languages,
  url,
}: RepositoryType) => (
  <Link
    className="bg-white shadow-md dark:bg-[#ba9bdd] rounded-sm p-4 h-full overflow-hidden flex flex-col justify-between"
    href={url}
    target="_blank"
    rel="noreferrer"
  >
    <div>
      <h3 className="text-black dark:text-white font-semibold text-xl">{name}</h3>
      <p className="text-gray-700 dark:text-gray-200 mb-4 text-base">{description}</p>
    </div>
    <div className="flex justify-between flex-col">
      {languages?.nodes && languages.nodes.length > 0 && (
        <div className="flex justify-between flex-row mb-3">
          <div>
            {languages.nodes.map((item) => (
              <span
                className="text-gray-700 dark:text-gray-200 italic mr-2 last:mr-0 text-xs"
                key={item?.id}
              >
                {item?.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center">
        <div className="flex items-center mr-2">
          <StarIcon className="text-black dark:text-white" />
          <span className="ml-2 text-black dark:text-white">{stargazers.totalCount}</span>
        </div>
        <div className="flex items-center">
          <GitFork className="text-black dark:text-white" />
          <span className="ml-2 text-black dark:text-white">{forkCount}</span>
        </div>
      </div>
    </div>
  </Link>
);

export default Repository;

