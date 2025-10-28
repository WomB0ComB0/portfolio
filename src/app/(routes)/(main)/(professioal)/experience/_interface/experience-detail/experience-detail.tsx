'use client';
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



import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod } from '@/utils';
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
import { notFound } from 'next/navigation';
import { type JSX, Suspense } from 'react';

/**
 * Interface representing the route parameters for the ExperienceDetail component.
 */
interface ExperienceDetailProps {
  params: { id: string };
}

/**
 * Skeleton loader for experience detail page
 */
const ExperienceDetailSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <Card className="border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              <div className="shrink-0 w-24 h-24 bg-muted animate-pulse rounded-lg ring-2 ring-border" />
              <div className="grow space-y-3 w-full">
                <div className="h-10 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-8 bg-muted animate-pulse rounded w-1/2" />
                <div className="flex flex-col gap-2 mt-4">
                  <div className="h-5 bg-muted animate-pulse rounded w-2/5" />
                  <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-5 bg-muted animate-pulse rounded w-2/5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8 md:p-10">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-6" />
            <div className="space-y-3">
              <div className="h-6 w-full bg-muted animate-pulse rounded-md" />
              <div className="h-6 w-11/12 bg-muted animate-pulse rounded-md" />
              <div className="h-6 w-full bg-muted animate-pulse rounded-md" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8 md:p-10">
            <div className="h-8 w-56 bg-muted animate-pulse rounded-md mb-6" />
            <ul className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="h-5 bg-muted animate-pulse rounded w-full" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8 md:p-10">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-6" />
            <div className="flex flex-wrap gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * Displays the content and detailed information for a specific experience.
 */
const ExperienceDetailContent = ({ id }: { id: string }): JSX.Element => {
  const { data: experiences } = useSanityExperiences();
  const experienceItem = experiences.find((exp) => exp._id === id);

  if (!experienceItem) {
    notFound();
  }

  const period = formatDatePeriod(
    experienceItem.startDate,
    experienceItem.endDate,
    experienceItem.current,
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <MagicCard className="border-border/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              {experienceItem.logo && (
                <div className="shrink-0 w-24 h-24 relative bg-background rounded-lg overflow-hidden ring-2 ring-border p-2 shadow-md">
                  <Image
                    src={
                      urlFor(experienceItem.logo).width(96).height(96).url() || '/placeholder.svg'
                    }
                    alt={`${experienceItem.company} logo`}
                    width={96}
                    height={96}
                    className="rounded-md object-contain"
                  />
                </div>
              )}

              <div className="grow space-y-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight text-balance">
                  {experienceItem.position}
                </h1>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-semibold text-primary">
                    {experienceItem.company}
                  </h2>
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground pt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{period}</span>
                  </div>

                  {experienceItem.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{experienceItem.location}</span>
                    </div>
                  )}

                  {experienceItem.companyUrl && (
                    <Link
                      href={experienceItem.companyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors group w-fit"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="group-hover:underline font-medium">
                        Visit Company Website
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </MagicCard>

        <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-8 md:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">Description</h3>
            </div>
            <Separator className="mb-6" />
            <p className="text-base text-foreground/90 leading-relaxed whitespace-pre-line">
              {experienceItem.description}
            </p>
          </CardContent>
        </MagicCard>

        {experienceItem.responsibilities && experienceItem.responsibilities.length > 0 && (
          <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">
                  Key Responsibilities
                </h3>
              </div>
              <Separator className="mb-6" />
              <ul className="space-y-4">
                {experienceItem.responsibilities.map((responsibility: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-foreground/80">
                    <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span className="leading-relaxed text-base">{responsibility}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </MagicCard>
        )}

        {experienceItem.technologies && experienceItem.technologies.length > 0 && (
          <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Code2 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">
                  Technologies Used
                </h3>
              </div>
              <Separator className="mb-6" />
              <div className="flex flex-wrap gap-3">
                {experienceItem.technologies.map((tech: string, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </MagicCard>
        )}

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
      </div>
    </div>
  );
};

/**
 * Renders the ExperienceDetail page, including suspense state and layout.
 */
export const ExperienceDetail = ({ params }: ExperienceDetailProps): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense fallback={<ExperienceDetailSkeleton />}>
          <ExperienceDetailContent id={params.id} />
        </Suspense>
      </div>
    </Layout>
  );
};
ExperienceDetail.displayName = 'ExperienceDetail';
export default ExperienceDetail;
