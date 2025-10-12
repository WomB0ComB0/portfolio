import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({ title: 'Forbidden' });

const ForbiddenError = dynamic(() => import('@/app/_client').then((mod) => mod.ForbiddenError), {
  ssr: true,
});

const Forbidden = (): React.JSX.Element => {
  return <ForbiddenError />;
};

Forbidden.displayName = 'Forbidden';
export default Forbidden;
