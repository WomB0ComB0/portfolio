import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Guestbook = dynamic(
  () => import('@/app/(routes)/(main)/guestbook/_interface/guestbook').then((mod) => mod.Guestbook),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Guestbook',
  description: 'Sign my guestbook and leave a message!',
});

/**
 * Guestbook page component.
 * Renders the guestbook interface for users to leave messages.
 *
 * @returns {JSX.Element} The guestbook page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const GuestbookPage = () => {
  return <Guestbook />;
};

export default GuestbookPage;
