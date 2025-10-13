import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Certifications = dynamic(
  () =>
    import(
      '@/app/(routes)/(main)/certifications/_interface/certifications'
    ).then((mod) => mod.Certifications),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Certifications',
  description: 'View my professional certifications and credentials',
});

const CertificationsPage = () => {
  return <Certifications />;
};

export default CertificationsPage;
