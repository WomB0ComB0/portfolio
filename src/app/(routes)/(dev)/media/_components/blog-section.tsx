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

import { CalendarIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX } from 'react';
import { SiDevdotto, SiHashnode } from 'react-icons/si';
import type { Blog } from '@/app/(routes)/(dev)/media/_lib/load-media';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/date';

const BLOG_SKELETON_CARDS = 6;

/**
 * Get the blog URL based on source
 */
function getBlogUrl(blog: Blog): string {
  if (blog.url) return blog.url;
  if (blog.source === 'devto') return `https://dev.to/mikeodnis/${blog.slug}`;
  return `https://blog.mikeodnis.dev/${blog.slug}`;
}

/**
 * Get source icon component
 */
function SourceIcon({ source }: { source?: 'hashnode' | 'devto' }) {
  if (source === 'devto') {
    return <SiDevdotto className="w-3 h-3" />;
  }
  return <SiHashnode className="w-3 h-3" />;
}

interface BlogCardProps {
  readonly blog: Blog;
  /** The panel's first cover: its likely LCP element, so it loads at once and first. */
  readonly isFirstImage: boolean;
}

const BlogCard = ({ blog, isFirstImage }: BlogCardProps): JSX.Element => (
  <div className="h-full w-full">
    <Link href={getBlogUrl(blog)} className="block h-full group" target="_blank">
      <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30 overflow-hidden">
        <div className="flex flex-col h-full">
          {blog.imageUrl && (
            <div className="relative w-full aspect-[1200/630] overflow-hidden bg-muted shrink-0">
              <Image
                src={blog.imageUrl || '/placeholder.svg'}
                alt={blog.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading={isFirstImage ? 'eager' : 'lazy'}
                fetchPriority={isFirstImage ? 'high' : undefined}
              />
            </div>
          )}
          <CardHeader className="pb-4 grow">
            <div className="flex items-center justify-between mb-3">
              <Badge
                variant="secondary"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
              >
                <SourceIcon source={blog.source} />
                {blog.source === 'devto' ? 'DEV.to' : 'Hashnode'}
              </Badge>
            </div>
            <CardTitle className="line-clamp-2 text-xl leading-snug group-hover:text-primary transition-colors">
              {blog.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 mt-auto">
            <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
              {blog.excerpt}
            </p>
            <div className="flex justify-between items-center text-sm text-muted-foreground border-t border-border/30 pt-5">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium">
                  {formatDate(blog.publishedAt, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </MagicCard>
    </Link>
  </div>
);

export interface BlogSectionProps {
  readonly items: readonly Blog[];
}

/**
 * @function BlogSection
 * @description
 *   Renders the blog posts section for the media page: posts from both Hashnode and DevTo,
 *   rendered on the server from the list the page loaded.
 * @returns {JSX.Element} The blog section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 2.0.0
 */
export const BlogSection = ({ items }: BlogSectionProps): JSX.Element => {
  const firstImageIndex = items.findIndex((blog) => Boolean(blog.imageUrl));
  return (
    <div className="grid gap-6 sm:gap-8 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] justify-center">
      {items.map((blog, index) => (
        <BlogCard
          key={`${blog.source || 'hashnode'}-${blog.slug}`}
          blog={blog}
          isFirstImage={index === firstImageIndex}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton loader for blog section
 */
export const BlogSkeleton = (): JSX.Element => (
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: BLOG_SKELETON_CARDS }, (_, i) => (
      <MagicCard key={`blog-skeleton-${Number(i)}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-7 w-11/12 rounded-lg" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2 rounded-lg" />
            <Skeleton className="h-4 w-full mb-2 rounded-lg" />
            <Skeleton className="h-4 w-5/6 mb-6 rounded-lg" />
            <div className="flex items-center text-sm text-muted-foreground">
              <Skeleton className="w-4 h-4 mr-2 rounded-full" />
              <Skeleton className="h-4 w-28 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </MagicCard>
    ))}
  </div>
);

BlogSection.displayName = 'BlogSection';
export default BlogSection;
