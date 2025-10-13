import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Spotify = dynamic(
  () =>
    import('@/app/(routes)/(main)/spotify/_interface/spotify').then(
      (mod) => mod.Spotify,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Spotify Stats',
  description: 'Check out my music taste and Spotify listening statistics',
});

const SpotifyPage = () => {
  return <Spotify />;
};

export default SpotifyPage;
