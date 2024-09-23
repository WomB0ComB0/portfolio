import Discord from '@/components/Discord';
import Stats from '@/components/Stats';
import Layout from '@/components/layout/Layout';

export default function DashboardPage() {
  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose prose-a:no-underline gap-6 mb-12">
          <div>
            <h1 className="dark:text-zinc-200 text-zinc-900 leading-none mb-3 sr-only">
              Dashboard
            </h1>
            <p className="dark:text-zinc-400 text-zinc-800 m-0 leading-tight">
              Random stats and stuff related to me.
            </p>
          </div>
          <Discord />
          <Stats />
        </section>
      </div>
    </Layout>
  );
}
