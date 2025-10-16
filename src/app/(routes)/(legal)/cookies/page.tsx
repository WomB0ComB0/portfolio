import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

/**
 * @constant Cookies
 * @description
 *      Dynamically imports the Cookies component representing the site's cookies policy.
 *      Used for code-splitting and optimization within Next.js, especially for legal routes.
 * @type {import('react').ComponentType}
 * @readonly
 * @web
 * @public
 * @throws {Error} Throws if importing the Cookies module fails or the file is not found.
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * // Usage in <CookiesPage />:
 * <Cookies />
 */
const Cookies = dynamic(
  () => import('@/app/(routes)/(legal)/cookies/_interface').then((mod) => mod.Cookies),
  { ssr: true },
);

/**
 * @constant metadata
 * @description
 *      Metadata for the cookies policy page, affects SEO and page headers.
 * @type {import('next').Metadata}
 * @readonly
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export const metadata = constructMetadata({
  title: 'Cookies Policy',
  description: 'Information about how cookies are used on this site.',
});

/**
 * @function CookiesPage
 * @description
 *      Page component rendering the dynamically loaded Cookies policy.
 *      Solely responsible for mounting the cookies policy in the legal route.
 * @returns {JSX.Element} The cookies policy React element, dynamically loaded.
 * @web
 * @public
 * @throws {Error} Throws if child component loading fails.
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see Cookies
 * @example
 * // Route handler for cookies policy:
 * export default function CookiesPage() {
 *   return <Cookies />;
 * }
 */
export default function CookiesPage() {
  return <Cookies />;
}

CookiesPage.displayName = 'CookiesPage';
