'use client';

import type { JSX } from 'react';
import Layout from '@/components/layout/layout';

/**
 * @function Privacy
 * @description
 *      Functional React component presenting the Privacy Policy for the portfolio site.
 *      Displays detailed information about the handling, collection, and protection of user data.
 *
 * @returns {JSX.Element}
 *      A React element containing the structured legal content for privacy practices on the website.
 *
 * @throws {never}
 *      This component is pure and does not throw by design, but errors may surface from React internals if misused.
 *
 * @example
 * // Usage in Privacy legal route:
 * <Privacy />
 *
 * @web
 * @readonly
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://developer.mozilla.org/en-US/docs/Web/Security/Privacy
 */
export const Privacy = (): JSX.Element => {
  return (
    <Layout>
      <section className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose dark:prose-invert max-w-none">
          <p>Details about privacy and data handling on this site.</p>
          <h2>Information We Collect</h2>
          <p>
            We collect information that you provide directly to us, as well as information about
            your use of our services.
          </p>
          <h2>How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services.</p>
          <h2>Data Security</h2>
          <p>We implement appropriate security measures to protect your personal information.</p>
        </div>
      </section>
    </Layout>
  );
};

Privacy.displayName = 'Privacy';

export default Privacy;
