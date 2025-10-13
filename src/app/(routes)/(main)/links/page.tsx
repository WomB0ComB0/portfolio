import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Links = dynamic(
  () => import('@/app/(routes)/(main)/links/_interface/links').then((mod) => mod.Links),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Links',
  description: 'Find all my social media profiles and important links in one place',
});

const LinksPage = () => {
  return <Links />;
};

export default LinksPage;
