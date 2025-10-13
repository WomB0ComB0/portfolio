import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const Guestbook = dynamic(
  () =>
    import('@/app/(routes)/(main)/guestbook/_interface/guestbook').then(
      (mod) => mod.Guestbook,
    ),
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
