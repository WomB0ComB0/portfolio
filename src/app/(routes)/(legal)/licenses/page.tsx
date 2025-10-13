import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Licenses = dynamic(
  () => import('@/app/(routes)/(legal)/licenses/_interface').then((mod) => mod.Licenses),
  { ssr: true }
);

export const metadata = constructMetadata({
  title: 'Licenses',
  description: 'Information about open source and third-party licenses.',
});

export const LicensesPage = () => <Licenses />;
LicensesPage.displayName = 'LicensesPage';

export default LicensesPage;
