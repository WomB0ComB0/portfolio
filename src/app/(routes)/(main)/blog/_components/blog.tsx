'use client';

import { format } from 'date-fns';
import { Schema } from 'effect';
import { CalendarIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { Suspense } from 'react';
import { MagicCard } from '@/components/magicui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';

const BlogPostSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
});

const BlogResponseSchema = Schema.Array(BlogPostSchema);

const Blog = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Latest Blog Posts</h1>
      <Suspense fallback={<BlogSkeleton />}>
        <DataLoader
          url="/api/v1/blog"
          schema={BlogResponseSchema}
          staleTime={1000 * 60 * 5}
          refetchInterval={1000 * 60 * 5}
          refetchOnWindowFocus={false}
          ErrorComponent={ErrorMessage}
        >
          {(data: Schema.Schema.Type<typeof BlogResponseSchema>) => (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {data.map((blog: Schema.Schema.Type<typeof BlogPostSchema>, index: number) => (
                  <motion.div
                    key={blog.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link
                      href={`https://blog.mikeodnis.dev/${blog.slug}`}
                      className="block h-full"
                      target="_blank"
                    >
                      <MagicCard className="h-full transition-shadow hover:shadow-lg">
                        <CardHeader>
                          <CardTitle className="line-clamp-2">{blog.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground mb-4 line-clamp-3">{blog.excerpt}</p>
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <CalendarIcon className="w-4 h-4 mr-1" />
                              <span>{format(new Date(blog.publishedAt), 'MMM d, yyyy')}</span>
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
    </div>
  );
};

const BlogSkeleton = () => (
  <div className="container mx-auto px-4 py-8">
    <Skeleton className="w-64 h-10 mb-8 mx-auto" />
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="h-full">
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const ErrorMessage = () => (
  <div className="container mx-auto px-4 py-8">
    <Card className="bg-red-50 border-red-200">
      <CardContent className="flex items-center justify-center p-6">
        <p className="text-red-600 font-semibold">
          Failed to load blog posts. Please try again later.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default Blog;
