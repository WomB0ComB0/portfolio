import { Blog } from '@/app/(routes)/(main)/blog/_components';
import Layout from '@/components/layout/layout';

/**
 * Blog view component.
 * Renders the blog page with the blog content inside a layout.
 *
 * @returns {JSX.Element} The blog view.
 * @author Mike Odnis
 * @version 1.0.0
 */
export const BlogView = () => {
  return (
    <Layout>
      <div className="w-full min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto mb-10">
          <h1 className="text-4xl font-bold mb-8 text-center sr-only">Blog</h1>
          <Blog />
        </div>
      </div>
    </Layout>
  );
};
