import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Privacy = dynamic(
  () => import('@/app/(routes)/(legal)/privacy/_interface').then((mod) => mod.Privacy),
  { ssr: true },
);

export const metadata = constructMetadata({
  title: 'Privacy Policy',
  description: 'Details about privacy and data handling on this site.',
});

export default function PrivacyPage() {
  return <Privacy />;
}

PrivacyPage.displayName = 'PrivacyPage';
