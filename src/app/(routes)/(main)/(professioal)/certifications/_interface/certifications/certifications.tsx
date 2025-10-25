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

'use client';

import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Calendar, ExternalLink, Hash } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo } from 'react';
// import { Skeleton } from '@/components/ui/skeleton';
import { useSanityCertifications } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import type { Certification } from '@/lib/sanity/types';
import { formatDateOnly } from '@/utils';

/**
 * Skeleton loader for individual certification cards
 */
const CertificationCardSkeleton = () => {
  return (
    <Card className="bg-card border-border rounded-xl overflow-hidden flex flex-col">
      {/* Image skeleton */}
      <div className="w-full h-48 relative bg-muted animate-pulse overflow-hidden" />

      <CardHeader className="p-6">
        {/* Title skeleton */}
        <div className="h-6 bg-muted animate-pulse rounded w-3/4 mb-2" />
        {/* Issuer skeleton */}
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
      </CardHeader>

      <CardContent className="p-6 pt-0 grow space-y-3">
        {/* Date info skeleton */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <Hash className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </div>
        </div>

        {/* Description skeleton */}
        <div className="space-y-2 mt-4 pt-2 border-t border-border">
          <div className="h-3 bg-muted animate-pulse rounded w-full" />
          <div className="h-3 bg-muted animate-pulse rounded w-full" />
          <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
        </div>

        {/* Skills skeleton */}
        <div className="pt-3">
          <div className="h-4 bg-muted animate-pulse rounded w-24 mb-2" />
          <div className="flex flex-wrap gap-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={`skill-skeleton-card-${+i}`}
                className="h-6 w-16 bg-muted animate-pulse rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Credential URL skeleton */}
        <div className="pt-3 mt-auto">
          <div className="inline-flex items-center gap-2 text-sm">
            <ExternalLink className="h-4 w-4" />
            <div className="h-4 bg-muted animate-pulse rounded w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Full loading skeleton for certifications page
 */
const CertificationsPageSkeleton = () => {
  return (
    <>
      <header className="mb-12 text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Award className="h-10 w-10 text-muted-foreground" />
          <div className="h-10 bg-muted animate-pulse rounded w-80" />
        </div>
        <div className="h-6 bg-muted animate-pulse rounded w-96 mx-auto" />
      </header>

      {/* Section skeleton */}
      {[...Array(2)].map((_, sectionIdx) => (
        <section key={`skills-section-card-${+sectionIdx}`} className="mb-12">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-border">
            <div className="h-1 w-12 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded w-48" />
            <div className="h-6 bg-muted animate-pulse rounded w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <CertificationCardSkeleton key={`skills-section-certification-card-${+i}`} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
};

/**
 * Displays a grouped list of professional certifications retrieved from Sanity.
 */
const CertificationsContent = () => {
  const { data: certifications } = useSanityCertifications();
  const certificationsList = certifications as any[];

  /**
   * Groups certifications by issuer/category
   */
  const groupedCertifications = useMemo(() => {
    if (!certificationsList) return {};
    return certificationsList.reduce(
      (acc, cert) => {
        const category = cert.issuer || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(cert);
        return acc;
      },
      {} as Record<string, Certification[]>,
    );
  }, [certificationsList]);

  return (
    <>
      <header className="mb-12 text-center space-y-4">
        <h1 className="text-4xl font-bold text-primary flex items-center justify-center gap-3">
          <Award className="h-10 w-10" />
          My Certifications
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A collection of my professional certifications and credentials.
        </p>
      </header>

      {Object.entries(groupedCertifications).map(([issuer, certs]) => (
        <section key={issuer} className="mb-12">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-border">
            <div className="h-1 w-12 bg-primary rounded" />
            <h2 className="text-2xl font-semibold text-foreground">{issuer}</h2>
            <span className="text-sm text-muted-foreground">
              ({(certs as any[]).length}{' '}
              {(certs as any[]).length === 1 ? 'certification' : 'certifications'})
            </span>
          </div>

          {(certs as any[]).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(certs as any[]).map((cert: any) => (
                <MagicCard
                  key={cert._id}
                  className="bg-card border-border rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 group flex flex-col"
                >
                  {cert.logo && (
                    <div className="w-full h-48 relative bg-muted overflow-hidden">
                      <Image
                        src={urlFor(cert.logo).width(512).height(288).url()}
                        alt={`${cert.name} logo`}
                        width={512}
                        height={288}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <CardHeader className="p-6">
                    <CardTitle className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300 leading-tight">
                      {cert.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-medium">{cert.issuer}</p>
                  </CardHeader>

                  <CardContent className="p-6 pt-0 flex flex-col grow space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          <strong className="text-foreground">Issued:</strong>{' '}
                          {formatDateOnly(cert.issueDate)}
                        </span>
                      </div>

                      {cert.expiryDate && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span>
                            <strong className="text-foreground">Expires:</strong>{' '}
                            {formatDateOnly(cert.expiryDate)}
                          </span>
                        </div>
                      )}

                      {cert.credentialId && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Hash className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="text-xs break-all">
                            <strong className="text-foreground">ID:</strong> {cert.credentialId}
                          </span>
                        </div>
                      )}
                    </div>

                    {cert.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed pt-3 border-t border-border">
                        {cert.description}
                      </p>
                    )}

                    {cert.skills && cert.skills.length > 0 && (
                      <div className="pt-3">
                        <h4 className="text-xs text-foreground mb-2 font-semibold uppercase tracking-wider">
                          Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {cert.skills.map((skill: string) => (
                            <span
                              key={skill}
                              className="px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full border border-border hover:border-primary hover:bg-secondary/80 transition-all duration-200"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {cert.credentialUrl && (
                      <div className="pt-4 mt-auto">
                        <Link
                          href={cert.credentialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors group/link"
                        >
                          <ExternalLink className="h-4 w-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform duration-200" />
                          <span className="group-hover/link:underline">View Certificate</span>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </MagicCard>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No certifications listed from this issuer yet.
            </p>
          )}
        </section>
      ))}

      {Object.keys(groupedCertifications).length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted mb-8">
            <Award className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-xl text-muted-foreground">
            No certifications available at the moment.
          </p>
        </div>
      )}
    </>
  );
};

/**
 * Renders the entire certifications page wrapped within the application's main layout.
 */
export const Certifications = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Suspense fallback={<CertificationsPageSkeleton />}>
          <CertificationsContent />
        </Suspense>
      </div>
    </Layout>
  );
};
Certifications.displayName = 'Certifications';
export default Certifications;
