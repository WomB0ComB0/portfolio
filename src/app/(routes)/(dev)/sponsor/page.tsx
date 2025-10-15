import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Sponsor = dynamic(
  () => import('./_interface/sponsor').then((mod) => mod.Sponsor),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Sponsor',
  description: 'Support my work through sponsorship. See my current sponsors and ways to contribute.',
});

const SponsorPage = () => {
  return <Sponsor />;
};

export default SponsorPage;
