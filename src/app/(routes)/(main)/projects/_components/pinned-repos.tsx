'use client';

import { Code2, GitFork, Star } from 'lucide-react';
import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PinnedRepo } from '@/lib/api-integrations';

interface PinnedReposProps {
  pinnedRepos: PinnedRepo[];
  isLoading?: boolean;
}

export default function PinnedRepos({ pinnedRepos, isLoading = false }: PinnedReposProps) {
  return (
    <section className="w-full max-w-4xl mb-10 px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-purple-300">Pinned Projects</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={`skeleton-${index}`} className="bg-[#1E1E1E] border-purple-800">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 bg-purple-300/20" />
                  <Skeleton className="h-4 w-full bg-gray-400/20 mt-2" />
                  <Skeleton className="h-4 w-5/6 bg-gray-400/20 mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-12 bg-gray-400/20" />
                      <Skeleton className="h-4 w-12 bg-gray-400/20" />
                    </div>
                    <Skeleton className="h-4 w-16 bg-gray-400/20" />
                  </div>
                </CardContent>
              </Card>
            ))
          : pinnedRepos.map((repo, index) => (
              <MagicCard
                key={`repo-${index + 1}`}
                className="h-full bg-[#1E1E1E] border border-purple-800 hover:shadow-md transition-shadow duration-300"
              >
                <Card className="h-full bg-transparent border-none flex flex-col">
                  <CardHeader className="flex-grow">
                    <CardTitle className="text-base sm:text-lg font-semibold text-purple-300">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {repo.name}
                      </a>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-gray-400 line-clamp-2 mt-1">
                      {repo.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs sm:text-sm">
                                <Star className="text-yellow-500 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="text-gray-400">{repo.stargazerCount}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-white">Stars</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs sm:text-sm">
                                <GitFork className="text-gray-500 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="text-gray-400">{repo.forkCount}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-white">Forks</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {repo.primaryLanguage && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-purple-800/30 border-purple-600"
                        >
                          <Code2 className="h-3 w-3 mr-1" />
                          {repo.primaryLanguage.name}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </MagicCard>
            ))}
      </div>
    </section>
  );
}
