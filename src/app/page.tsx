import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import getRepos from '@/lib/getRepos';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const DynamicPinnedRepos = dynamic(() => import('@/components/github/PinnedRepos'), {
  loading: () => <Skeleton className="w-full h-full bg-purple-300" />,
  ssr: false,
});

export const revalidate = 60 * 60 * 24;

export default async function Home() {
  const pinnedRepos = await getRepos();

  return (
    <Layout>
      <div className="w-full min-h-screen p-8 flex flex-col justify-start items-center relative">
        <section className="flex flex-col-reverse md:flex-row w-full max-w-4xl justify-between items-center mb-20 mt-16 gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold mb-2 text-[#ba9bdd]">Mike Odnis</h1>
            <p className="text-xl mb-4 text-purple-300">Undergraduate Computer Science Student</p>
            <p className="relative text-sm text-gray-400 max-w-lg">
              Passionate about web development and open source. Currently studying at Farmingdale
              State College. I enjoy exploring new technologies and sharing my knowledge with the
              developer community.
            </p>
          </div>
          <Image
            src="https://avatars.githubusercontent.com/u/95197809?v=4"
            alt="Mike Odnis"
            className="relative rounded-full shadow-xl w-32 h-32 grayscale hover:grayscale-0 transition-all duration-300"
            width={128}
            height={128}
            priority
          />
        </section>
        <DynamicPinnedRepos pinnedRepos={pinnedRepos} />
      </div>
    </Layout>
  );
}
