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

/**
 * Resume page component.
 * Renders the resume interface for viewing and downloading the professional resume.
 *
 * @returns {JSX.Element} The resume page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const ResumePage = () => {
  return <Resume />;
};

export default ResumePage;
