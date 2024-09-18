import PinnedRepos from '@/components/github/PinnedRepos';
import Footer from '@/components/layout/Footer';
import Layout from '@/components/layout/Layout';
import { getBlogs } from '@/lib/blogs';
import { getPinnedRepos } from '@/lib/repos';
import type { Blog, Repo } from '@/lib/types';
import Image from 'next/image';

async function Home() {
  const latestPosts = await getBlogs();
  const pinnedRepos = await getPinnedRepos();

  return (
    <Layout>
      <div className="w-full h-full p-8 flex flex-col justify-center items-center relative">
        <section className="flex flex-col-reverse lg:flex-row md:flex-row w-full justify-between items-start mb-20 mt-16 lg:mt-0 md:mt-0 gap-4 lg:gap-14 md:gap-8 prose">
          <div className="leading-none">
            <h2 className="dark:text-zinc-200 text-zinc-900 text-[2.5rem] m-0 font-extrabold">
              Mike Odnis
            </h2>
            <p className="dark:text-zinc-300 text-zinc-800 mb-4 m-0">
              Undergraduate Computer Science Student
            </p>
            <p className="dark:text-zinc-400 text-zinc-700 text-sm m-0">
              Passionate about web development and open source. Currently studying at Farmingdale
              State College. I enjoy exploring new technologies and sharing my knowledge with the
              developer community.
            </p>
          </div>
          <div className="min-w-fit">
            <Image
              src="https://avatars.githubusercontent.com/u/95197809?v=4"
              alt="avatar"
              className="rounded-full shadow-xl min-w-32 h-32 grayscale m-0"
              width={128}
              height={128}
            />
          </div>
        </section>
        {/* <RecentBlogs recentBlogs={props.latestPosts} /> */}
        <PinnedRepos pinnedRepos={pinnedRepos} />
        <Footer />
      </div>
    </Layout>
  );
}

export default Home;
