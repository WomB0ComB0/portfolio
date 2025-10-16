import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Spotify = dynamic(
  () => import('@/app/(routes)/(main)/spotify/_interface/spotify').then((mod) => mod.Spotify),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Spotify Stats',
  description: 'Check out my music taste and Spotify listening statistics',
});

/**
 * Spotify page component.
 * Renders the Spotify statistics page.
 *
 * @returns {JSX.Element} The Spotify page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const SpotifyPage = () => {
  return <Spotify />;
};

export default SpotifyPage;
