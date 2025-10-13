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

const GuestbookPage = () => {
  return <Guestbook />;
};

export default GuestbookPage;
