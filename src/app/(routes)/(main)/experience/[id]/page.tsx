import dynamic from 'next/dynamic';
import { getExperiences } from '@/lib/sanity/api';
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
  try {
    const experiences = await getExperiences();
    return experiences.map((exp) => ({
      id: exp._id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const experiences = await getExperiences();
    const experienceItem = experiences.find((exp) => exp._id === id);

    if (!experienceItem) {
      return constructMetadata({
        title: 'Experience Not Found',
        description: 'The requested experience item could not be found',
      });
    }

    return constructMetadata({
      title: `${experienceItem.position} at ${experienceItem.company}`,
      description: experienceItem.description,
    });
  } catch (error) {
    console.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Experience',
      description: 'View professional experience details',
    });
  }
}

const ExperienceDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  return <ExperienceDetail params={resolvedParams} />;
};

export default ExperienceDetailPage;
