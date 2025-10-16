import { DevStats, Discord, GitHubStats } from '@/app/(routes)/(dev)/stats/_components';
import Layout from '@/components/layout/layout';

/**
 * @function Stats
 * @description
 *      Top-level presentational component providing a dashboard summary with layout, general prose,
 *      and a vertical stack of key personal statistics including Discord presence, coding/dev stats,
 *      and GitHub analytics for the portfolio project.
 *      Acts as the single export for the stats module page.
 *
 * @web
 * @public
 * @readonly
 * @returns {JSX.Element}
 *      React component wrapping statistics dashboard UI, including layout and individual stats widgets.
 * @throws {Error}
 *      May throw rendering errors if child components throw.
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @see Layout
 * @see Discord
 * @see DevStats
 * @see GitHubStats
 * @example
 * // Usage in routing:
 * <Stats />
 */
export const Stats = () => {
  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose prose-a:no-underline gap-8 mb-12">
          <div>
            <h1 className="dark:text-zinc-200 text-zinc-900 leading-none mb-3 sr-only">Stats</h1>
            <p className="dark:text-zinc-400 text-zinc-800 m-0 leading-tight">
              Personal, site, coding stats related to me.
            </p>
          </div>
          <Discord />
          <DevStats />
          <GitHubStats />
        </section>
      </div>
    </Layout>
  );
};
