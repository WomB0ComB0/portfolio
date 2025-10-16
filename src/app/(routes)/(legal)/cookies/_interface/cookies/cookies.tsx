'use client';

import type { JSX } from 'react';
import Layout from '@/components/layout/layout';

/**
 * @function Cookies
 * @description
 *      Presents the cookies policy for the portfolio site, detailing the usage and types of cookies utilized.
 *      This functional React component serves as the informational legal document accessible by end users.
 *
 * @returns {JSX.Element}
 *      A React element containing the structured legal content for cookies and related practices.
 *
 * @web
 * @readonly
 * @public
 * @version 1.0.0
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
 * @example
 * // Usage in cookies policy route:
 * <Cookies />
 */
export const Cookies = (): JSX.Element => {
  return (
    <Layout>
      <section className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">Cookies Policy</h1>
        <div className="prose dark:prose-invert max-w-none">
          <p>This page describes how cookies are used on this site.</p>
          <h2>What are cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device when you visit a website.
          </p>
          <h2>How we use cookies</h2>
          <p>
            We use cookies to improve your experience, analyze site traffic, and personalize
            content.
          </p>
        </div>
      </section>
    </Layout>
  );
};
Cookies.displayName = 'Cookies';
export default Cookies;
