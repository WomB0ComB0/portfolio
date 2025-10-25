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

import { Blog } from '@/app/(routes)/(dev)/blog/_components';
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
BlogView.displayName = 'BlogView';
export default BlogView;
