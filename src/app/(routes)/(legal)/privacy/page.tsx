import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Privacy = dynamic(
  () => import('@/app/(routes)/(legal)/privacy/_interface').then((mod) => mod.Privacy),
  { ssr: true }
);

export const metadata = constructMetadata({
  title: 'Privacy Policy',
  description: 'Details about privacy and data handling on this site.',
});

export const PrivacyPage = () => <Privacy />;
PrivacyPage.displayName = 'PrivacyPage';

export default PrivacyPage;
