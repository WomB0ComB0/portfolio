'use client';

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

import { Schema } from 'effect';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';
import { SiDevdotto, SiHashnode } from 'react-icons/si';
import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { formatDate } from '@/utils/date';

/**
 * Blog post schema for Effect validation
 */
const BlogPostSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String),
  source: Schema.optional(Schema.Union(Schema.Literal('hashnode'), Schema.Literal('devto'))),
  url: Schema.optional(Schema.String),
});

const BlogResponseSchema = Schema.Array(BlogPostSchema);

/**
 * Get the blog URL based on source
 */
function getBlogUrl(blog: Schema.Schema.Type<typeof BlogPostSchema>): string {
  if (blog.url) return blog.url;
  if (blog.source === 'devto') return `https://dev.to/womb0comb0/${blog.slug}`;
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

/**
 * @function BlogSection
 * @description
 *   Renders the blog posts section for the media page.
 *   Displays blogs from both Hashnode and DevTo.
 * @returns {JSX.Element} The blog section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const BlogSection = (): JSX.Element => {
  return (
    <Suspense fallback={<BlogSkeleton />}>
      <DataLoader
        url="/api/v1/blog"
        schema={BlogResponseSchema}
        staleTime={1000 * 60 * 5}
        refetchInterval={1000 * 60 * 5}
        refetchOnWindowFocus={false}
        ErrorComponent={BlogErrorMessage}
      >
        {(data: Schema.Schema.Type<typeof BlogResponseSchema>) => (
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {data.map((blog: Schema.Schema.Type<typeof BlogPostSchema>, index: number) => (
                <motion.div
                  key={`${blog.source || 'hashnode'}-${blog.slug}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link href={getBlogUrl(blog)} className="block h-full group" target="_blank">
                    <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30 overflow-hidden">
                      {blog.imageUrl && (
                        <div className="relative w-full h-52 overflow-hidden bg-muted">
                          <Image
                            src={blog.imageUrl || '/placeholder.svg'}
                            alt={blog.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-4">
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
                      <CardContent className="pt-0">
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
                    </MagicCard>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </DataLoader>
    </Suspense>
  );
};

/**
 * Skeleton loader for blog section
 */
const BlogSkeleton = (): JSX.Element => (
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {new Array(6).fill(null).map((_, i) => (
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

/**
 * Error message component for blog section
 */
const BlogErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/40 bg-destructive/5">
    <CardContent className="flex items-center justify-center p-8">
      <p className="font-semibold text-destructive text-center">
        Failed to load blog posts. Please try again later.
      </p>
    </CardContent>
  </Card>
);

BlogSection.displayName = 'BlogSection';
export default BlogSection;
