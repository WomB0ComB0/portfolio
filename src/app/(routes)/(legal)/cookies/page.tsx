import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Cookies = dynamic(
  () => import('@/app/(routes)/(legal)/cookies/_interface').then((mod) => mod.Cookies),
  { ssr: true },
);

export const metadata = constructMetadata({
  title: 'Cookies Policy',
  description: 'Information about how cookies are used on this site.',
});

export const CookiesPage = () => <Cookies />;
CookiesPage.displayName = 'CookiesPage';

export default CookiesPage;
