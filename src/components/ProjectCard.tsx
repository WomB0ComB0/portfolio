import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import { GlobeAltIcon } from './heroicons';
import { DevpostIcon, FigmaIcon, GithubIcon } from './simpleicons/index';
import { Badge } from './ui/badge';

export const ProjectCard: React.FC<ProjectProps> = ({
  name,
  description,
  techStack,
  link,
  image,
  imageAlt,
  github,
  devpost,
  figma,
}) => {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="flex h-full max-h-[800px] min-h-[629px] w-[80%] min-w-[500px] max-w-[900px] shrink-0 snap-center flex-col items-center justify-around space-y-5 overflow-hidden rounded-lg bg-[#292929] p-20 opacity-40 transition-opacity duration-200 hover:opacity-100 hover:drop-shadow-lg sm:p-5 md:p-4"
      >
        <div className="max-w-  flex h-1/2 max-h-[500px] flex-row items-center justify-center gap-5 object-contain">
          <Image
            src={image}
            alt={imageAlt}
            width={512}
            height={512}
            className={`size-[200px] select-none rounded-lg object-contain`}
          />
          <div className="">
            <h4 className="text-center text-4xl font-semibold ">
              <span className="underline decoration-[#560BAD]/50 ">{name}</span>
            </h4>
            <div className="justify-flex-start transition-color mt-4 flex items-center gap-2">
              {[
                { icon: github, href: github, IconComponent: GithubIcon },
                { icon: link, href: link, IconComponent: GlobeAltIcon },
                { icon: devpost, href: devpost, IconComponent: DevpostIcon },
                { icon: figma, href: figma, IconComponent: FigmaIcon },
              ].map(
                (item) =>
                  item.icon && (
                    <>
                      <Link
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`cursor-pointer`}
                      >
                        <item.IconComponent width={30}>{item.href}</item.IconComponent>
                      </Link>
                    </>
                  ),
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-[30px] flex w-full flex-wrap justify-center space-x-2">
            {techStack.map((technologies) => (
              <Badge
                key={technologies}
                className="mb-[5px] h-[35px] cursor-pointer select-none border-2 border-[#BA9BDD] bg-transparent text-[#BA9BDD] transition-all hover:border-[#BA9BDD]/40 hover:bg-transparent hover:text-[#BA9BDD]/40 hover:shadow-md"
              >
                {technologies}
              </Badge>
            ))}
          </div>
          <div className="mx-auto w-full space-y-2 sm:w-[90%]">
            {description.map((paragraph) => (
              <ul key={paragraph} className="sm:text-md list-disc text-left text-lg">
                <li className="cursor-pointer transition-colors hover:text-[#BA9BDD]">{paragraph}</li>
              </ul>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
};
