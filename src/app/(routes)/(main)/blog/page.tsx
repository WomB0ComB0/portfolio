import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const BlogView = dynamic(
  () => import('@/app/(routes)/(main)/blog/_interface/blog').then((mod) => mod.BlogView),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Blog',
  description: 'Read my latest articles and thoughts on technology, software development, and more',
});

const BlogPage = () => {
  return <BlogView />;
};

export default BlogPage;
