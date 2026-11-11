import 'server-only';
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
 * @file A project's page body, rendered on the server from the project the page loaded. Image
 * URLs are built here; the gallery is the only client island and gets them as plain strings.
 * Nothing animates in, so the server HTML is visible as soon as it arrives.
 */

import { ArrowLeft, Calendar, ExternalLink, FileText, ImageIcon, Layers } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX, ReactNode } from 'react';
import { FaGithub } from 'react-icons/fa';
import { BorderBeam } from '@/components/magicui/border-beam';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Project } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import { cn } from '@/lib/utils';
import { formatDatePeriod, formatMonthYear } from '@/utils/date';
import DraggableGallery from '../../_components/draggable-gallery';
import type { ProjectDetailProps } from './project-detail.types';

/** Hero and gallery images: 16:9 at the hero's widest. */
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 675;

/** How strongly the hero's backdrop copy of the image is blurred. */
const BACKDROP_BLUR = 100;

/** Shown when Sanity has a gallery entry but no URL can be built for it. */
const GALLERY_IMAGE_FALLBACK = '/assets/svgs/logo.svg';

type SanityImage = NonNullable<Project['image']>;

export interface GalleryImage {
  url: string;
  alt: string;
}

const imageUrl = (image: SanityImage): string =>
  urlFor(image).width(IMAGE_WIDTH).height(IMAGE_HEIGHT).url();

/** The gallery's images as plain URLs and alt texts, ready for the client island. */
export const galleryImages = (images: readonly SanityImage[]): GalleryImage[] =>
  images.map((image) => ({
    url: imageUrl(image) || GALLERY_IMAGE_FALLBACK,
    alt: image.alt || 'Project image',
  }));

/** "Jan 2025 - Mar 2025", "Started Jan 2025", or a note that there is no date. */
const projectDateRange = ({ startDate, endDate }: Project): string => {
  if (startDate && endDate) return formatDatePeriod(startDate, endDate);
  if (startDate) return `Started ${formatMonthYear(startDate)}`;
  return 'Date not available';
};

const SECTION_CARD_CLASS =
  'border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300';

/** One of the page's cards. */
const SectionCard = ({
  className = SECTION_CARD_CLASS,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element => (
  <MagicCard className={className}>
    <CardContent className="p-8 md:p-10">{children}</CardContent>
  </MagicCard>
);

/** A card's icon (in a tinted tile) and h2. */
const SectionHeading = ({
  icon,
  iconTileClassName = 'bg-primary/10',
  className = 'mb-6',
  children,
}: {
  icon: ReactNode;
  iconTileClassName?: string;
  className?: string;
  children: ReactNode;
}): JSX.Element => (
  <div className={cn('flex items-center gap-3', className)}>
    <div className={cn('p-2 rounded-lg', iconTileClassName)}>{icon}</div>
    <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{children}</h2>
  </div>
);

/**
 * The hero: 60vh, held between 450 and 650 px. Its height is a variable so the screenshot inside
 * can size itself to it.
 */
const HERO_CLASS =
  'relative w-full h-(--hero-h) [--hero-h:clamp(450px,60vh,650px)] flex items-center justify-center overflow-hidden';

/**
 * The screenshot's 16:9 frame: as wide as 80% of the hero and max-w-4xl (56rem) allow, and never
 * so wide that it is taller than the hero minus 6rem, so 3rem stays free above and below it. In
 * the 1200 px column a plain 80% made it 504 px tall, more than a laptop's 450 px hero, and its
 * top and bottom were cut off.
 */
const SCREENSHOT_FRAME_CLASS =
  'relative w-[min(80%,56rem,(var(--hero-h)-6rem)*16/9)] aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10';

/**
 * The cards below the hero. They rise 2rem into it, within the 3rem the screenshot always leaves
 * free, so the opaque summary card never covers the image; -mt-24 hid its bottom 96 px.
 */
const BODY_CLASS = 'container mx-auto px-4 -mt-8 relative z-10 pb-24';

/** The image, over a blurred, faded copy of itself. */
const ProjectHero = ({ project }: ProjectDetailProps): JSX.Element => (
  <div className={HERO_CLASS}>
    {project.image && (
      <>
        <Image
          src={urlFor(project.image)
            .width(IMAGE_WIDTH)
            .height(IMAGE_HEIGHT)
            .blur(BACKDROP_BLUR)
            .url()}
          alt=""
          fill
          className="object-cover scale-110 rounded-lg opacity-30"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-transparent rounded-lg" />
      </>
    )}

    <div className={SCREENSHOT_FRAME_CLASS}>
      {project.image ? (
        <Image
          src={imageUrl(project.image)}
          alt={project.title}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 80vw, 1200px"
        />
      ) : (
        <div className="w-full h-full bg-linear-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
          <p className="text-muted-foreground">No Image Available</p>
        </div>
      )}
      <BorderBeam
        size={400}
        duration={10}
        delay={9}
        colorFrom="var(--brand)"
        colorTo="var(--brand-ink)"
        borderWidth={2}
      />
    </div>
  </div>
);

/** The live and source links, styled as the buttons they were (a link, not a nested button). */
const ProjectLinks = ({ liveUrl, githubUrl }: Project): JSX.Element => (
  <div className="flex flex-wrap gap-3">
    {liveUrl && (
      <Link
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({
            size: 'lg',
            className: 'gap-2 shadow-lg hover:shadow-xl transition-all duration-300',
          }),
        )}
      >
        View Live Project
        <ExternalLink className="h-4 w-4" />
      </Link>
    )}
    {githubUrl && (
      <Link
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({
            variant: 'outline',
            size: 'lg',
            className:
              'gap-2 bg-background/50 backdrop-blur-sm hover:bg-background border-border/50 hover:border-border shadow-md hover:shadow-lg transition-all duration-300',
          }),
        )}
      >
        <FaGithub className="h-4 w-4" />
        View Source Code
      </Link>
    )}
  </div>
);

/** The page's only h1, its category, status and dates, and the live and source links. */
const ProjectSummary = ({ project }: ProjectDetailProps): JSX.Element => (
  <SectionCard className="border-border/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow duration-300">
    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
      {project.title}
    </h1>

    <div className="flex flex-wrap items-center gap-3 mb-8">
      <Badge variant="secondary" className="px-4 py-2 text-sm font-medium gap-2">
        <Layers className="h-3.5 w-3.5" />
        {project.category}
      </Badge>
      <Badge
        variant="outline"
        className="px-4 py-2 text-sm font-medium border-primary/30 text-primary"
      >
        {project.status}
      </Badge>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>{projectDateRange(project)}</span>
      </div>
    </div>

    <ProjectLinks {...project} />
  </SectionCard>
);

const ProjectTechnologies = ({
  technologies,
}: {
  technologies: readonly string[];
}): JSX.Element => (
  <SectionCard>
    <SectionHeading
      icon={<Layers className="h-5 w-5 text-accent" />}
      iconTileClassName="bg-accent/10"
    >
      Technologies Used
    </SectionHeading>
    <Separator className="mb-6" />
    <div className="flex flex-wrap gap-3">
      {technologies.map((tech) => (
        <Badge
          key={tech}
          variant="secondary"
          className="px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default"
        >
          {tech}
        </Badge>
      ))}
    </div>
  </SectionCard>
);

const ProjectGallery = ({ images }: { images: readonly SanityImage[] }): JSX.Element => (
  <SectionCard>
    <SectionHeading icon={<ImageIcon className="h-5 w-5 text-primary" />} className="mb-4">
      Project Gallery
    </SectionHeading>
    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
      Hover over any image to view it in full screen. Drag horizontally to browse through the
      gallery.
    </p>
    <Separator className="mb-6" />
    <DraggableGallery images={galleryImages(images)} />
  </SectionCard>
);

/** The button's classes, then the link's own, joined as the Button asChild it replaces did. */
const BACK_LINK_CLASS = `${cn(
  buttonVariants({
    size: 'lg',
    variant: 'outline',
    className:
      'w-full sm:w-auto mx-auto bg-background/80 backdrop-blur-md border-border/50 hover:bg-background hover:border-primary/50 shadow-lg transition-all duration-300 group',
  }),
)} flex items-center justify-center`;

const BackToProjects = (): JSX.Element => (
  <div className="pt-8">
    <Link href="/projects" className={BACK_LINK_CLASS}>
      <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
      Back to All Projects
    </Link>
  </div>
);

/** The project page: hero image, summary, description, overview, technologies and gallery. */
export function ProjectDetail({ project }: ProjectDetailProps): JSX.Element {
  return (
    <>
      <ProjectHero project={project} />

      <div className={BODY_CLASS}>
        <div className="max-w-5xl mx-auto space-y-8">
          <ProjectSummary project={project} />

          <SectionCard>
            <SectionHeading icon={<FileText className="h-5 w-5 text-primary" />}>
              Description
            </SectionHeading>
            <p className="text-lg text-foreground/90 leading-relaxed">{project.description}</p>
          </SectionCard>

          {project.longDescription && (
            <SectionCard>
              <SectionHeading icon={<FileText className="h-5 w-5 text-primary" />}>
                Project Overview
              </SectionHeading>
              <Separator className="mb-6" />
              <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                {project.longDescription}
              </p>
            </SectionCard>
          )}

          {project.technologies.length > 0 && (
            <ProjectTechnologies technologies={project.technologies} />
          )}

          {project.images && project.images.length > 0 && (
            <ProjectGallery images={project.images} />
          )}

          <BackToProjects />
        </div>
      </div>
    </>
  );
}

export default ProjectDetail;
