import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Places = dynamic(
  () =>
    import('@/app/(routes)/(main)/places/_interface/places').then((mod) => mod.Places),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Places',
  description: 'Explore the locations I have visited, including hackathons, tech events, and more',
});

const PlacesPage = () => {
  return <Places />;
};

export default PlacesPage;
