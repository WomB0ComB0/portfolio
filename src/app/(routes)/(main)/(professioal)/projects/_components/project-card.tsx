/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file One project in the /projects grid. It renders inside the client filter island, so it takes
 * a plain DTO whose image URL the server already built: nothing here may import the Sanity client.
 * Hover effects are CSS only; there is no entrance animation, so the server HTML is visible as is.
 */

import { ArrowUpRight, Code2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX } from 'react';
import { FaGithub } from 'react-icons/fa';
import { LinkPending } from '@/components/data/link-pending';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';

/** What a project card shows, built on the server by `toProjectCard`. */
export interface ProjectCardData {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly technologies: readonly string[];
  /** Only its presence shows: the whole card is one link to the project page. */
  readonly githubUrl: string | null;
  /** Null when the project has no image; the card then shows an icon placeholder. */
  readonly imageUrl: string | null;
  readonly imageAlt: string;
}

export interface ProjectCardProps {
  project: ProjectCardData;
}

/** The project grid, shared by the list and its loading skeleton so both lay out alike. */
export const PROJECT_GRID_CLASS =
  'grid gap-8 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]';

/** How many technologies a card names before it shows "+N". */
const VISIBLE_TECHNOLOGIES = 3;

/** The project page's path; ids are encoded so any id stays one path segment. */
export const projectHref = (id: string): string => `/projects/${encodeURIComponent(id)}`;

const ProjectCardImage = ({ project }: ProjectCardProps): JSX.Element => (
  <div className="relative w-full aspect-video overflow-hidden bg-muted/20">
    {project.imageUrl ? (
      <Image
        src={project.imageUrl}
        alt={project.imageAlt}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    ) : (
      <div
        data-slot="project-image-placeholder"
        className="w-full h-full flex items-center justify-center bg-muted/10"
      >
        <Code2 aria-hidden="true" className="h-12 w-12 text-muted-foreground/20" />
      </div>
    )}
    <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

    {/* Floating Category Badge */}
    <div className="absolute top-4 left-4 max-w-[calc(100%-2rem)]">
      <Badge className="bg-background/80 backdrop-blur-md text-foreground border-white/10 shadow-lg max-w-full hover:bg-background/90 transition-colors">
        <span className="truncate">{project.category}</span>
      </Badge>
    </div>

    {/* Marks a project with source code; not a link of its own, the card already is one. */}
    {project.githubUrl && (
      <div className="absolute top-4 right-4 translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 delay-100">
        <div className="p-2 bg-background/80 backdrop-blur-md rounded-full text-foreground hover:text-primary shadow-lg cursor-pointer">
          <FaGithub aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
    )}
  </div>
);

const TechnologyList = ({ technologies }: { technologies: readonly string[] }) => {
  if (technologies.length === 0) return null;
  const hidden = technologies.length - VISIBLE_TECHNOLOGIES;
  return (
    <div className="flex flex-wrap gap-1.5">
      {technologies.slice(0, VISIBLE_TECHNOLOGIES).map((tech, idx) => (
        <span
          key={`${tech}-${+idx}`}
          className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-primary/5 text-primary rounded-md border border-primary/10"
        >
          {tech}
        </span>
      ))}
      {hidden > 0 && (
        <span className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          +{hidden}
        </span>
      )}
    </div>
  );
};

/**
 * A project card: one link to the project page. While that page loads, a small spinner beside
 * "View Project" shows the click landed (detail pages have no loading skeleton).
 */
export function ProjectCard({ project }: ProjectCardProps): JSX.Element {
  return (
    <div className="group h-full w-full">
      <Link href={projectHref(project.id)} className="block h-full">
        <MagicCard className="relative bg-card/40 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden h-full transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2">
          <div className="flex flex-col h-full">
            <ProjectCardImage project={project} />

            <CardContent className="p-6 flex flex-col grow relative">
              <div className="space-y-3 mb-4">
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {project.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {project.description}
                </p>
              </div>

              <div className="mt-auto space-y-6">
                <TechnologyList technologies={project.technologies} />

                {/* Action Footer */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    View Project
                    <LinkPending />
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110">
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </MagicCard>
      </Link>
    </div>
  );
}
