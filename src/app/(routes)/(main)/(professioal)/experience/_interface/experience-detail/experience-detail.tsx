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
 * @file One experience, rendered on the server from the document its page already loaded. The
 * page answers 404 for an unknown id before this renders, so there is no loading or missing
 * state here. The logo is built with urlFor, which is why this module is server-only.
 */

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  MapPin,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX, ReactNode } from 'react';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Experience } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod } from '@/utils/date';
import type { ExperienceDetailProps } from './experience-detail.types';

/** The logo's rendered size, also requested from Sanity's image CDN. */
const LOGO_SIZE_PX = 96;

const SECTION_CARD_CLASS =
  'border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300';

/** A titled card under the summary: an icon, an h3 and a rule above the content. */
const DetailSection = ({
  icon,
  title,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element => (
  <MagicCard className={SECTION_CARD_CLASS}>
    <CardContent className="p-8 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">{icon}</div>
        <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h3>
      </div>
      <Separator className="mb-6" />
      {children}
    </CardContent>
  </MagicCard>
);

/** Dates, location and the company's site, under the company name. */
const ExperienceFacts = ({ experience }: { readonly experience: Experience }): JSX.Element => (
  <div className="flex flex-col gap-2 text-sm text-muted-foreground pt-2">
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4" />
      <span className="font-medium">
        {formatDatePeriod(experience.startDate, experience.endDate, experience.current)}
      </span>
    </div>

    {experience.location && (
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        <span>{experience.location}</span>
      </div>
    )}

    {experience.companyUrl && (
      <Link
        href={experience.companyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors group w-fit"
      >
        <ExternalLink className="h-4 w-4" />
        <span className="group-hover:underline font-medium">Visit Company Website</span>
      </Link>
    )}
  </div>
);

/** The page's only h1 (the position), the company, and the logo when there is one. */
const ExperienceSummary = ({ experience }: { readonly experience: Experience }): JSX.Element => (
  <MagicCard className="border-border/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow duration-300">
    <CardContent className="p-8 md:p-10">
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
        {experience.logo && (
          <div className="shrink-0 w-24 h-24 relative bg-background rounded-lg overflow-hidden ring-2 ring-border p-2 shadow-md">
            <Image
              src={
                urlFor(experience.logo).width(LOGO_SIZE_PX).height(LOGO_SIZE_PX).url() ||
                '/placeholder.svg'
              }
              alt={`${experience.company} logo`}
              width={LOGO_SIZE_PX}
              height={LOGO_SIZE_PX}
              className="rounded-md object-contain"
            />
          </div>
        )}

        <div className="grow space-y-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight text-balance">
            {experience.position}
          </h1>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-semibold text-primary">{experience.company}</h2>
          </div>
          <ExperienceFacts experience={experience} />
        </div>
      </div>
    </CardContent>
  </MagicCard>
);

interface KeyedText {
  readonly key: string;
  readonly text: string;
}

/** Each entry with a key that stays unique when the CMS lists the same text twice. */
const withKeys = (items: readonly string[]): readonly KeyedText[] =>
  items.map((text, position) => ({
    key: `${text}#${items.slice(0, position).filter((earlier) => earlier === text).length}`,
    text,
  }));

const Responsibilities = ({ items }: { readonly items: readonly string[] }): JSX.Element => (
  <DetailSection
    icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
    title="Key Responsibilities"
  >
    <ul className="space-y-4">
      {withKeys(items).map(({ key, text }) => (
        <li key={key} className="flex items-start gap-3 text-foreground/80">
          <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
          <span className="leading-relaxed text-base">{text}</span>
        </li>
      ))}
    </ul>
  </DetailSection>
);

const Technologies = ({ items }: { readonly items: readonly string[] }): JSX.Element => (
  <DetailSection icon={<Code2 className="h-5 w-5 text-primary" />} title="Technologies Used">
    <div className="flex flex-wrap gap-3">
      {withKeys(items).map(({ key, text }) => (
        <Badge
          key={key}
          variant="secondary"
          className="px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default"
        >
          {text}
        </Badge>
      ))}
    </div>
  </DetailSection>
);

const BackToExperience = (): JSX.Element => (
  <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg">
    <CardContent className="p-6">
      <Button
        asChild
        size="lg"
        variant="outline"
        className="w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-background border-border/50 hover:border-border shadow-md hover:shadow-lg transition-all duration-300 group"
      >
        <Link href="/experience">
          <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to Experience
        </Link>
      </Button>
    </CardContent>
  </MagicCard>
);

/** One experience in full: summary, description, responsibilities and technologies. */
export const ExperienceDetail = ({ experience }: ExperienceDetailProps): JSX.Element => {
  const { responsibilities, technologies } = experience;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <ExperienceSummary experience={experience} />

          <DetailSection icon={<FileText className="h-5 w-5 text-primary" />} title="Description">
            <p className="text-base text-foreground/90 leading-relaxed whitespace-pre-line">
              {experience.description}
            </p>
          </DetailSection>

          {responsibilities && responsibilities.length > 0 && (
            <Responsibilities items={responsibilities} />
          )}
          {technologies && technologies.length > 0 && <Technologies items={technologies} />}

          <BackToExperience />
        </div>
      </div>
    </div>
  );
};
ExperienceDetail.displayName = 'ExperienceDetail';
export default ExperienceDetail;
