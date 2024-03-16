import NavBar from "./Nav";
import MobileNavBar from "./MobileNav";
import { KBarProvider } from "kbar";
import Palette from "./CMD";
import { actions } from "../lib/actions";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentRoute = useRouter().pathname;
  return (
    <div>
      <KBarProvider actions={actions}>
        <main className="flex selection:bg-zinc-200/30 flex-col overflow-x-hidden min-h-screen items-center bg-zinc-100 dark:bg-zinc-900 font-clash max-h-auto relative">
          <Palette />
          <div className="flex w-full h-full lg:w-[60%] md:w-2/3">
            <div className="w-[6%] fixed left-0 h-full z-50 hidden lg:block md:block">
              <NavBar path={currentRoute} />
            </div>
            <div className="fixed top-0 w-full z-50 block lg:hidden md:hidden px-8 pt-4">
              <MobileNavBar path={currentRoute} />
            </div>
            {children}
          </div>
        </main>
      </KBarProvider>
    </div>
  );
}
