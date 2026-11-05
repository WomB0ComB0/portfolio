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
 * @file The /experience timeline, rendered on the server with every experience in it. There is
 * no entrance animation (it would put opacity 0 into the server HTML), so hover is CSS only.
 * Logos are built with urlFor here, which is why this module is server-only.
 */

import { ArrowRight, Briefcase, Calendar, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX, ReactNode } from 'react';
import { PageHeader } from '@/components/custom/page-header';
import { LinkPending } from '@/components/data';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Experience } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import { cn } from '@/lib/utils';
import { formatDatePeriod } from '@/utils/date';

/** The logo's rendered size, also requested from Sanity's image CDN. */
const LOGO_SIZE_PX = 56;

/** Rows in the loading skeleton: enough to fill a screen at every width. */
const SKELETON_ROW_COUNT = 4;

/** The skeleton's rows, alternating sides like the loaded timeline. */
const SKELETON_ROWS = Array.from({ length: SKELETON_ROW_COUNT }, (_, row) => ({
  id: `timeline-skeleton-${row}`,
  isLeft: row % 2 === 0,
}));

const SPINE_GRADIENT = 'bg-linear-to-b from-primary/50 via-primary to-primary/20';

export interface ExperienceListProps {
  readonly experiences: readonly Experience[];
}

interface TimelineCardProps {
  readonly item: Experience;
  readonly period: string;
  readonly logoUrl: string | null;
}

/** The container, header and spacing shared by the timeline and its skeleton. */
const ExperiencePageFrame = ({ children }: { readonly children: ReactNode }): JSX.Element => (
  <div className="container mx-auto px-4 py-12 max-w-7xl space-y-12">
    <PageHeader
      title="Work Experience"
      description="A chronological journey through my professional career"
      icon={<Briefcase />}
    />
    {children}
  </div>
);

/** The timeline marker; the current role pulses. */
const TimelineDot = ({ isCurrent }: { readonly isCurrent: boolean }): JSX.Element => (
  <>
    <div
      className={cn(
        'w-5 h-5 rounded-full border-4 border-background ring-2 ring-primary/30',
        isCurrent ? 'bg-primary shadow-lg shadow-primary/50 animate-pulse' : 'bg-primary/70',
      )}
    />
    {isCurrent && <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />}
  </>
);

const TimelineCard = ({ item, period, logoUrl }: TimelineCardProps): JSX.Element => (
  <div className="transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]">
    <MagicCard className="relative backdrop-blur-sm border-border/50 rounded-xl overflow-hidden group hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
      <CardHeader className="p-6 pt-8">
        <div className="flex items-start gap-4">
          {logoUrl && (
            <div className="shrink-0 w-14 h-14 relative bg-background rounded-xl overflow-hidden ring-2 ring-border/50 group-hover:ring-primary/50 transition-all duration-300 shadow-md motion-safe:hover:scale-105">
              <Image
                src={logoUrl}
                alt={`${item.company} logo`}
                width={LOGO_SIZE_PX}
                height={LOGO_SIZE_PX}
                className="rounded-xl object-contain p-2"
              />
            </div>
          )}

          <div className="grow min-w-0 space-y-2">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
              {item.position}
            </CardTitle>
            <p className="text-base text-muted-foreground font-medium group-hover:text-foreground transition-colors duration-300">
              {item.company}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                variant="outline"
                className="text-xs bg-secondary/50 border-border/50 text-secondary-foreground flex items-center gap-1"
              >
                <Calendar className="h-3 w-3" />
                {period}
              </Badge>
              {item.location && (
                <Badge
                  variant="outline"
                  className="text-xs bg-secondary/50 border-border/50 text-secondary-foreground flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.description}
        </p>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="relative w-full bg-transparent border-border/50 hover:border-primary text-secondary-foreground hover:text-white transition-all duration-300 group/btn"
        >
          <Link href={`/experience/${encodeURIComponent(item._id)}`}>
            <span className="flex items-center justify-center gap-2 text-white">
              View Details
              <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
              <LinkPending className="absolute right-3 top-1/2 -translate-y-1/2" />
            </span>
          </Link>
        </Button>
      </CardContent>
    </MagicCard>
  </div>
);

/**
 * One experience: alternating sides of the centre spine from lg up, and a single column beside
 * the left spine below it. Both layouts are in the markup and CSS shows one.
 */
const TimelineRow = ({
  item,
  isLeft,
}: {
  readonly item: Experience;
  readonly isLeft: boolean;
}): JSX.Element => {
  const period = formatDatePeriod(item.startDate, item.endDate, item.current);
  const logoUrl = item.logo
    ? urlFor(item.logo).width(LOGO_SIZE_PX).height(LOGO_SIZE_PX).url()
    : null;
  const card = <TimelineCard item={item} period={period} logoUrl={logoUrl} />;

  return (
    <div className="relative">
      <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:items-center">
        <div>{isLeft ? card : null}</div>
        <div className="flex items-center justify-center relative z-10">
          <TimelineDot isCurrent={item.current} />
        </div>
        <div>{isLeft ? null : card}</div>
      </div>

      <div className="lg:hidden relative pl-8">
        <div className="absolute left-0 top-8">
          <TimelineDot isCurrent={item.current} />
        </div>
        {card}
      </div>
    </div>
  );
};

const EmptyTimeline = (): JSX.Element => (
  <div className="text-center py-20">
    <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-muted/50 mb-6">
      <Briefcase className="h-12 w-12 text-muted-foreground" />
    </div>
    <p className="text-xl text-muted-foreground">No work experience listed at the moment.</p>
  </div>
);

/** The work experience timeline, every entry in Sanity's order, each linking to its page. */
export const ExperienceList = ({ experiences }: ExperienceListProps): JSX.Element => (
  <ExperiencePageFrame>
    <div className="space-y-12">
      {experiences.length > 0 ? (
        <div className="relative max-w-6xl mx-auto">
          <div
            className={cn(
              'absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 hidden lg:block',
              SPINE_GRADIENT,
            )}
          />
          <div className={cn('absolute left-2.5 top-0 bottom-0 w-0.5 lg:hidden', SPINE_GRADIENT)} />

          <div className="space-y-12 lg:space-y-16">
            {experiences.map((item, index) => (
              <TimelineRow key={item._id} item={item} isLeft={index % 2 === 0} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyTimeline />
      )}
    </div>
  </ExperiencePageFrame>
);
ExperienceList.displayName = 'ExperienceList';

const SkeletonBar = ({ className }: { readonly className: string }): JSX.Element => (
  <div className={cn('bg-muted animate-pulse rounded', className)} />
);

/** A card the height of a real one: header, two description lines and the button. */
const TimelineCardSkeleton = (): JSX.Element => (
  <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-xl overflow-hidden">
    <CardHeader className="p-6 pt-8">
      <div className="flex items-start gap-4">
        <SkeletonBar className="shrink-0 w-14 h-14 rounded-xl" />
        <div className="grow min-w-0 space-y-2">
          <SkeletonBar className="h-5.5 w-3/4" />
          <SkeletonBar className="h-6 w-1/2" />
          <div className="flex flex-wrap gap-2 pt-1">
            <SkeletonBar className="h-5.5 w-32 rounded-md" />
            <SkeletonBar className="h-5.5 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </CardHeader>
    <CardContent className="px-6 pb-6 space-y-4">
      <div className="flex h-11.5 flex-col justify-center gap-2.5">
        <SkeletonBar className="h-4 w-full" />
        <SkeletonBar className="h-4 w-5/6" />
      </div>
      <SkeletonBar className="h-8 w-full rounded-md" />
    </CardContent>
  </Card>
);

const SkeletonDot = (): JSX.Element => (
  <div className="w-5 h-5 rounded-full bg-muted animate-pulse ring-4 ring-background" />
);

const TimelineRowSkeleton = ({ isLeft }: { readonly isLeft: boolean }): JSX.Element => (
  <div className="relative">
    <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:items-center">
      <div>{isLeft ? <TimelineCardSkeleton /> : null}</div>
      <div className="flex items-center justify-center relative z-10">
        <SkeletonDot />
      </div>
      <div>{isLeft ? null : <TimelineCardSkeleton />}</div>
    </div>

    <div className="lg:hidden relative pl-8">
      <div className="absolute left-0 top-8">
        <SkeletonDot />
      </div>
      <TimelineCardSkeleton />
    </div>
  </div>
);

/** The timeline's loading state, laid out like the loaded page, header included. */
export const ExperienceListSkeleton = (): JSX.Element => (
  <ExperiencePageFrame>
    <p role="status" className="sr-only">
      Loading work experience
    </p>
    <div className="space-y-12" aria-hidden="true">
      <div className="relative max-w-6xl mx-auto">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted/30 -translate-x-1/2 hidden lg:block" />
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-muted/30 lg:hidden" />

        <div className="space-y-12 lg:space-y-16">
          {SKELETON_ROWS.map(({ id, isLeft }) => (
            <TimelineRowSkeleton key={id} isLeft={isLeft} />
          ))}
        </div>
      </div>
    </div>
  </ExperiencePageFrame>
);
ExperienceListSkeleton.displayName = 'ExperienceListSkeleton';

export default ExperienceList;
