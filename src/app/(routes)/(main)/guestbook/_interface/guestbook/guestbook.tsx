import { GuestbookComponent } from '@/app/(routes)/(main)/guestbook/_components';
import Layout from '@/components/layout/layout';

/**
 * Guestbook component.
 * Renders the guestbook interface where users can leave messages.
 *
 * @returns {JSX.Element} The guestbook view.
 * @author Mike Odnis
 * @version 1.0.0
 */
export const Guestbook = () => {
  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose mb-10">
          <h1 className="dark:text-zinc-200 text-[#ba9bdd] leading-none mb-3 sr-only">Guestbook</h1>
          <GuestbookComponent />
        </section>
      </div>
    </Layout>
  );
};
