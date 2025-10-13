import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Resume = dynamic(
  () => import('@/app/(routes)/(main)/resume/_interface/resume').then((mod) => mod.Resume),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Resume',
  description: 'View and download my professional resume',
});

const ResumePage = () => {
  return <Resume />;
};

export default ResumePage;
