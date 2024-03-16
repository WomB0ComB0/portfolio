import type { PinnedRepos } from "../lib/types";
import { FiStar, FiArrowRight } from "react-icons/fi";
import { VscRepoForked } from "react-icons/vsc";
import Link from "next/link";

export default function PinnedRepos(props: { pinnedRepos: PinnedRepos }) {
  return (
    <section className="flex flex-col w-full gap-6 mb-10 prose prose-a:no-underline">
      <h2
        className="dark:text-zinc-200 text-zinc-900 text-[2.5rem] font-extrabold leading-none m-0"
        id="projects"
      >
        Top Projects
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 w-full gap-6">
        {props.pinnedRepos.map((repo, index) => (
          <Link
            key={index}
            href={`${repo.url}`}
            target="_blank"
            rel="noreferrer"
            className="bg-gradient-to-r from-zinc-500 to-stone-500 p-1 gap-4 rounded-lg shadow-lg dark:shadow-zinc-200/10 shadow-zinc-800/10 hover:shadow-xl hover:scale-[103%] dark:hover:shadow-zinc-200/10 hover:shadow-zinc-800/10 duration-300"
          >
            <div className="flex flex-col cursor-pointer justify-between h-full dark:bg-zinc-800 bg-zinc-200 p-4 rounded-lg ">
              <div>
                <h3 className="dark:text-zinc-200 text-zinc-800 m-0 mb-6 text-lg font-semibold w-full tracking-tight leading-none">
                  {repo.name}
                </h3>
                <p className="dark:text-zinc-300 text-zinc-700 m-0 mb-6 text-sm w-full tracking-tight">
                  {repo.description}
                </p>
              </div>
              <div className="gap-6 flex">
                <div className="flex dark:text-zinc-400 text-zinc-600 gap-2 text-base items-center font-semibold">
                  <FiStar />
                  <p className="m-0">{repo.stars}</p>
                </div>
                <div className="flex dark:text-zinc-400 text-zinc-600 gap-2 text-base items-center font-semibold">
                  <VscRepoForked />
                  <p className="m-0">{repo.forks}</p>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
      <Link
        href="https://github.com/WomB0ComB0?tab=repositories"
        target="_blank"
        rel="noreferrer"
        className="flex group gap-2 items-center duration-200 text-zinc-500 cursor-pointer no-underline dark:hover:text-zinc-400 hover:text-zinc-700 "
      >
        View More{" "}
        <span className="group-hover:translate-x-1 duration-200">
          <FiArrowRight />
        </span>
      </a>
    </section>
  );
}
