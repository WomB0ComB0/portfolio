import dynamic from 'next/dynamic';
import { experienceData } from '@/data/home-sections';
import { constructMetadata } from '@/utils';

const ExperienceDetail = dynamic(
  () =>
    import('@/app/(routes)/(main)/experience/_interface/experience-detail').then(
      (mod) => mod.ExperienceDetail,
    ),
  {
    ssr: true,
  },
);

export async function generateStaticParams() {
  return experienceData.map((exp) => ({
    id: exp.id,
  }));
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const experienceItem = experienceData.find((exp) => exp.id === params.id);

  if (!experienceItem) {
    return constructMetadata({
      title: 'Experience Not Found',
      description: 'The requested experience item could not be found',
    });
  }

  return constructMetadata({
    title: `${experienceItem.jobTitle} at ${experienceItem.companyTitle}`,
    description: experienceItem.jobDescriptionShort,
  });
}

const ExperienceDetailPage = ({ params }: { params: { id: string } }) => {
  return <ExperienceDetail params={params} />;
};

export default ExperienceDetailPage;
