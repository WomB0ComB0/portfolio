import type { Repository } from '@/generated/graphql';
import { GitFork, StarIcon } from 'lucide-react';
import Link from 'next/link';

const Repository = ({ name, description, stargazers, forkCount, languages, url }: Repository) => (
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
