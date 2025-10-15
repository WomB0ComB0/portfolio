import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Stats = dynamic(
  () => import('@/app/(routes)/(dev)/stats/_interface/stats').then((mod) => mod.Stats),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Stats',
  description: 'View my live stats, Discord status, and activity metrics',
});

const StatsPage = () => {
  return <Stats />;
};

export default StatsPage;
