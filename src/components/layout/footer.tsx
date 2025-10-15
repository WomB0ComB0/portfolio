import Link from 'next/link';

export const Footer = () => {
  const linkClasses = "dark:text-[#ba9bdd] text-[#ba9bdd] hover:text-[#ba9bdd] dark:hover:text-[#ba9bdd] duration-300 underline decoration-dotted underline-offset-4";
  
  return (
    <footer className="w-full py-4 px-4 md:px-8 mt-auto">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 w-full justify-between items-center mx-auto">
        <p className="dark:text-[#ba9bdd] text-[#ba9bdd]-700 m-0 text-sm text-center sm:text-left pl-10" suppressHydrationWarning>
          <Link
            className={linkClasses}
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noreferrer"
            suppressHydrationWarning
          >
            MIT
          </Link>{' '}
          2024-present &#169;{' '}
          <Link
            className={linkClasses}
            href="https://github.com/WomB0ComB0"
            target="_blank"
            rel="noreferrer"
            suppressHydrationWarning
          >
            Mike Odnis
          </Link>
        </p>
        
        <nav className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs" suppressHydrationWarning>
          <Link className={linkClasses} href="/licenses">
            Licenses
          </Link>
          <span className="dark:text-[#ba9bdd] text-[#ba9bdd] hidden sm:inline">•</span>
          <Link
            className={linkClasses}
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </Link>
          <span className="dark:text-[#ba9bdd] text-[#ba9bdd] hidden sm:inline">•</span>
          <Link
            className={linkClasses}
            href="https://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apache 2.0
          </Link>
          <span className="dark:text-[#ba9bdd] text-[#ba9bdd] hidden sm:inline">•</span>
          <Link
            className={linkClasses}
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY-NC-SA 4.0
          </Link>
        </nav>
      </div>
    </footer>
  );
};

Footer.displayName = 'Footer';
export default Footer;
