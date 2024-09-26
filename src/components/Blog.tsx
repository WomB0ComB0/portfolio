'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { atom, useAtom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { MagicCard } from './magicui';

interface BlogPost {
  title: string;
  slug: string;
  publishedAt: string;
  excerpt: string;
}

const blogAtom = atom<BlogPost[]>([]);

const blogEffectAtom = atomEffect((get, set) => {
  const fetchBlogs = async () => {
    try {
      const data = await fetcher<string>('/api/v1/blog');
      const parsedData: { json: BlogPost[] } = JSON.parse(data);
      set(blogAtom, parsedData.json);
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
      set(blogAtom, []);
    }
  };

  fetchBlogs();
  const intervalId = setInterval(fetchBlogs, 1000 * 60 * 5);

  return () => clearInterval(intervalId);
});

const Blog = () => {
  const [blogs] = useAtom(blogAtom);
  useAtom(blogEffectAtom);

  const { isLoading, error } = useQuery<string>({
    queryKey: ['blogs'],
    queryFn: () => fetcher<string>('/api/v1/blog'),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  if (isLoading) return <BlogSkeleton />;
  if (error) return <ErrorMessage />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Latest Blog Posts</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {blogs.map((blog, index) => (
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
