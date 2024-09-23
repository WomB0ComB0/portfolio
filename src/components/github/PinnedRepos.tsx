import type { PinnedRepo } from '@/lib/getRepos';
import Link from 'next/link';
import { FiStar } from 'react-icons/fi';
import { VscRepoForked } from 'react-icons/vsc';
import { MagicCard } from '../magicui';

export default function PinnedRepos({ pinnedRepos }: { pinnedRepos: PinnedRepo[] }) {
  return (
    <section className="w-full max-w-4xl mb-10">
      <h2 className="text-3xl font-bold mb-6 text-purple-300">Pinned Projects</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pinnedRepos.map((repo, index: number | string) => (
          <Link
            key={`repo-${+index + 1}`}
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            className="no-underline"
          >
            <MagicCard className="h-full bg-[#1E1E1E] border border-purple-800 hover:shadow-md transition-shadow duration-300">
              <div className="grid grid-rows-[auto_1fr_auto] h-full p-4 gap-2">
                <h3 className="text-lg font-semibold text-purple-300">{repo.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{repo.description}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-sm">
                      <FiStar className="text-yellow-500" />
                      <span className="text-gray-400">{repo.stargazerCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <VscRepoForked className="text-gray-500" />
                      <span className="text-gray-400">{repo.forkCount}</span>
                    </div>
                  </div>
                  {repo.primaryLanguage && (
                    <span className="text-xs text-gray-500">{repo.primaryLanguage.name}</span>
                  )}
                </div>
              </div>
            </MagicCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
