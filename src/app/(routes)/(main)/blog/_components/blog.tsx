'use client';

import { format } from 'date-fns';
import { Schema } from 'effect';
import { CalendarIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';
import { MagicCard } from '@/components/magicui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';

/**
 * @readonly
 * @constant
 * @description
 *   Schema definition for a single blog post object containing the basic metadata required for display.
 * @property {string} title - The title of the blog post.
 * @property {string} slug - The unique slug identifier for the blog post.
 * @property {string} publishedAt - Date string indicating when the post was published.
 * @property {string} excerpt - Short excerpt or summary of the blog post.
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @web
 * @public
 */
const BlogPostSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
});

/**
 * @readonly
 * @constant
 * @description
 *   Schema definition for an array of blog post objects, utilizing BlogPostSchema as its item definition.
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @web
 * @public
 */
const BlogResponseSchema = Schema.Array(BlogPostSchema);

/**
 * @function Blog
 * @description
 *   Renders a list of blog posts retrieved from a backend API. Utilizes suspense and data loader
 *   to provide loading, error, and fully-rendered states. Each blog post is displayed as a card
 *   with animation, title, excerpt, and publication date. Supports skeleton loading UI and error feedback.
 * @returns {JSX.Element} The React JSX element containing the styled blog post grid with loading and error states.
 * @throws {Error} May throw if DataLoader fails unexpectedly, or if a rendering error occurs.
 * @web
 * @public
 * @author Mike Odnis
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns
 * @see DataLoader
 * @see BlogSkeleton
 * @see ErrorMessage
 * @example
 * // Usage in Next.js page:
 * export default function BlogPage() {
 *   return <Blog />;
 * }
 * @version 1.0.0
 */
const Blog = (): JSX.Element => {
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

/**
 * @function BlogSkeleton
 * @description
 *   Renders a skeleton loading UI for the blog post grid.
 *   Used as a fallback while the blog data is loading.
 * @returns {JSX.Element} A stylized skeleton placeholder for the blog list.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://mantine.dev/core/skeleton/
 * @example
 * <Suspense fallback={<BlogSkeleton />} />
 */
const BlogSkeleton = (): JSX.Element => (
  <div className="container mx-auto px-4 py-8">
    <Skeleton className="w-64 h-10 mb-8 mx-auto" />
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <MagicCard key={i} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-11/12" />
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-4" />
              <div className="flex items-center text-sm text-muted-foreground">
                <Skeleton className="w-4 h-4 mr-1 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        </MagicCard>
      ))}
    </div>
  </div>
);

/**
 * @function ErrorMessage
 * @description
 *   Displays an error UI message for when loading blog posts fails.
 *   Used as the error fallback within DataLoader.
 * @returns {JSX.Element} React JSX element for the UI error state.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see DataLoader
 * @example
 * <DataLoader ErrorComponent={ErrorMessage} />
 */
const ErrorMessage = (): JSX.Element => (
  <div className="container mx-auto px-4 py-8">
    <Card className="border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center justify-center p-6">
        <p className="font-semibold text-destructive">
          Failed to load blog posts. Please try again later.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default Blog;
