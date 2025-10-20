/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitFork, StarIcon } from 'lucide-react';
import Link from 'next/link';
import type { Repository as RepositoryType } from '@/generated/graphql';

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
export const Repository = ({
  name,
  description,
  stargazers,
  forkCount,
  languages,
  url,
}: RepositoryType) => (
  <Link
    className="bg-card shadow-md rounded-sm p-4 h-full overflow-hidden flex flex-col justify-between"
    href={url}
    target="_blank"
    rel="noreferrer"
  >
    <div>
      <h3 className="text-card-foreground font-semibold text-xl">{name}</h3>
      <p className="text-muted-foreground mb-4 text-base">{description}</p>
    </div>
    <div className="flex justify-between flex-col">
      {languages?.nodes && languages.nodes.length > 0 && (
        <div className="flex justify-between flex-row mb-3">
          <div>
            {languages.nodes.map((item) => (
              <span className="text-muted-foreground italic mr-2 last:mr-0 text-xs" key={item?.id}>
                {item?.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center">
        <div className="flex items-center mr-2">
          <StarIcon className="text-card-foreground" />
          <span className="ml-2 text-card-foreground">{stargazers.totalCount}</span>
        </div>
        <div className="flex items-center">
          <GitFork className="text-card-foreground" />
          <span className="ml-2 text-card-foreground">{forkCount}</span>
        </div>
      </div>
    </div>
  </Link>
);
Repository.displayName = 'Repository';
export default Repository;
