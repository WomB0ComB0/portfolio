import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

const Dashboard = dynamic(
  () => import('@/app/(routes)/(main)/dashboard/_interface/dashboard').then((mod) => mod.Dashboard),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Dashboard',
  description: 'View my live stats, Discord status, and activity metrics',
});

const DashboardPage = () => {
  return <Dashboard />;
};

export default DashboardPage;
