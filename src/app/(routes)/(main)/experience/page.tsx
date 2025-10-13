import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const ExperienceList = dynamic(
  () =>
    import('@/app/(routes)/(main)/experience/_interface/experience-list').then(
      (mod) => mod.ExperienceList,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Experience',
  description: 'Explore my professional work experience and career journey',
});

const ExperiencePage = () => {
  return <ExperienceList />;
};

export default ExperiencePage;
