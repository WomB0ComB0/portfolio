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

import { CalendarIcon, ExternalLinkIcon, UsersIcon } from 'lucide-react';
import type { JSX } from 'react';
import type { Article } from '@/app/(routes)/(dev)/media/_lib/load-media';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/date';

const ARTICLE_SKELETON_CARDS = 3;

const ArticleCard = ({ article }: { article: Article }): JSX.Element => (
  <div className="h-full w-full">
    <a
      href={article.publicationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <MagicCard className="h-full transition-shadow hover:shadow-lg">
        <div className="flex flex-col h-full">
          <CardHeader className="grow">
            <CardTitle className="line-clamp-2">{article.title}</CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ExternalLinkIcon className="w-3 h-3" />
              {article.publication}
            </p>
          </CardHeader>
          <CardContent className="mt-auto">
            <p className="text-muted-foreground mb-4 line-clamp-3">{article.excerpt}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags?.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-auto">
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-2" />
                <span>
                  {formatDate(article.publishedDate, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {article.coAuthors && article.coAuthors.length > 0 && (
                <div className="flex items-center">
                  <UsersIcon className="w-4 h-4 mr-2" />
                  <span className="line-clamp-1">Co-authors: {article.coAuthors.join(', ')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </MagicCard>
    </a>
  </div>
);

export interface ArticlesSectionProps {
  readonly items: readonly Article[];
}

/**
 * @function ArticlesSection
 * @description
 *   Renders the articles section for the media page, on the server from the list the page
 *   loaded.
 * @returns {JSX.Element} The articles section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 2.0.0
 */
export const ArticlesSection = ({ items }: ArticlesSectionProps): JSX.Element =>
  items.length === 0 ? (
    <EmptyState message="No articles available yet." />
  ) : (
    <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] justify-center">
      {items.map((article) => (
        <ArticleCard key={article._id} article={article} />
      ))}
    </div>
  );

/**
 * Skeleton loader for articles section
 */
export const ArticlesSkeleton = (): JSX.Element => (
  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: ARTICLE_SKELETON_CARDS }, (_, i) => (
      <MagicCard key={`article-skeleton-${Number(i)}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-4" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </MagicCard>
    ))}
  </div>
);

/**
 * Empty state component
 */
const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <Card className="border-muted">
    <CardContent className="flex items-center justify-center p-12">
      <p className="text-muted-foreground">{message}</p>
    </CardContent>
  </Card>
);

ArticlesSection.displayName = 'ArticlesSection';
export default ArticlesSection;
