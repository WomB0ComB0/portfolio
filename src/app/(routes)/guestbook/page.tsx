import GuestbookComponent from '@/components/Guestbook';
import Layout from '@/components/layout/Layout';

export default function GuestbookPage() {
  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose mb-10">
          <h1 className="dark:text-zinc-200 text-[#ba9bdd] leading-none mb-3 sr-only">Guestbook</h1>
          <p className="dark:text-zinc-400 text-zinc-800 m-0 leading-tight">
            Leave a message for me and other visitors here! It can be anything - appreciation,
            criticism, or just a random message. Just be nice!
          </p>
          <GuestbookComponent />
        </section>
      </div>
    </Layout>
  );
}
