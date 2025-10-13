import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const About = dynamic(
  () => import('@/app/(routes)/(main)/about/_interface/about').then((mod) => mod.About),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'About',
  description: 'Learn more about Mike Odnis - Software Developer & Computer Science Student',
});

const AboutPage = () => {
  return <About />;
};

export default AboutPage;
