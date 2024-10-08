import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="flex w-full prose absolute bottom-0 py-4 lg:px-0 md:px-8 px-8">
      <p className="dark:text-[#ba9bdd] text-[#ba9bdd]-700 m-0 text-sm">
        <Link
          className="dark:text-[#ba9bdd] text-[#ba9bdd] hover:text-[#ba9bdd] dark:hover:text-[#ba9bdd] duration-300 underline decoration-dotted underline-offset-4"
          href="https://opensource.org/licenses/MIT"
          target={'_blank'}
          rel="noreferrer"
        >
          MIT
        </Link>{' '}
        2024-present &#169;{' '}
        <Link
          className="dark:text-[#ba9bdd] dark:hover:text-[#ba9bdd] text-[#ba9bdd] hover:text-[#ba9bdd] duration-300 underline decoration-dotted underline-offset-4"
          href="https://github.com/WomB0ComB0"
          target={'_blank'}
          rel="noreferrer"
        >
          Mike Odnis
        </Link>
      </p>
    </footer>
  );
}
