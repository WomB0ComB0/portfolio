'use client';

import { MagicCard, PageHeader } from '@/components';

/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSanityCertifications } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDateOnly } from '@/utils';
import { Award, Building2, Calendar, Code2, ExternalLink, Hash } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo } from 'react';

/**
 * Skeleton loader for individual certification cards
 */
const CertificationCardSkeleton = () => {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="w-full h-48 relative bg-muted/50 animate-pulse overflow-hidden rounded-t-lg" />

      <CardHeader className="p-6 space-y-3">
        <div className="h-6 bg-muted/50 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted/50 animate-pulse rounded w-1/2" />
      </CardHeader>

      <CardContent className="p-6 pt-0 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="h-4 bg-muted/50 animate-pulse rounded w-2/3" />
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div className="h-4 bg-muted/50 animate-pulse rounded w-3/4" />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="h-3 bg-muted/50 animate-pulse rounded w-full" />
          <div className="h-3 bg-muted/50 animate-pulse rounded w-full" />
          <div className="h-3 bg-muted/50 animate-pulse rounded w-2/3" />
        </div>

        <div className="space-y-2">
          <div className="h-4 bg-muted/50 animate-pulse rounded w-24" />
          <div className="flex flex-wrap gap-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={`skill-skeleton-${i}`}
                className="h-6 w-16 bg-muted/50 animate-pulse rounded-full"
              />
            ))}
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
      <PageHeader
        title="My Certifications"
        description="A collection of my professional certifications and credentials."
        icon={<Award />}
      />

      {[...Array(2)].map((_, sectionIdx) => (
        <section key={`section-skeleton-${sectionIdx}`} className="mb-12">
          <Card className="bg-card/30 backdrop-blur-sm border-border/50 p-6 mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div className="h-8 bg-muted/50 animate-pulse rounded w-48" />
              <div className="h-6 bg-muted/50 animate-pulse rounded-full w-24" />
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <CertificationCardSkeleton key={`cert-skeleton-${i}`} />
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

  // FIX: Safely infer the type of a single certification object from the array.
  // This helps us create a mutable array type for the accumulator.
  type CertificationItem = NonNullable<typeof certifications>[number];

  /**
   * Groups certifications by issuer/category
   */
  const groupedCertifications = useMemo(() => {
    if (!certifications) return {};
    return certifications.reduce(
      (acc, cert) => {
        const category = cert.issuer || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(cert);
        return acc;
      },
      {} as Record<string, CertificationItem[]>,
    );
  }, [certifications]);

  return (
    <>
      <PageHeader
        title="My Certifications"
        description="A collection of my professional certifications and credentials."
        icon={<Award />}
      />

      {Object.entries(groupedCertifications).map(([issuer, certs]) => (
        <section key={issuer} className="mb-12">
          <MagicCard className="backdrop-blur-sm border-border/50 shadow-md p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{issuer}</h2>
              <Badge variant="secondary" className="ml-auto">
                {certs.length} {certs.length === 1 ? 'certification' : 'certifications'}
              </Badge>
            </div>
          </MagicCard>

          {certs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certs.map((cert) => {
                if (!cert) return null;
                return (
                  <MagicCard
                    key={cert._id}
                    className="backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 group overflow-hidden"
                  >
                    {cert.image && (
                      <div className="w-full h-48 relative bg-linear-to-br from-muted/50 to-muted/30 overflow-hidden">
                        <Image
                          src={
                            urlFor(cert.image.asset._ref).width(512).height(288).url() ||
                            '/placeholder.svg'
                          }
                          alt={`${cert.image?.alt} logo`}
                          width={512}
                          height={288}
                          className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <CardHeader className="p-6 space-y-2">
                      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
                        {cert.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {cert.issuer}
                      </p>
                    </CardHeader>

                    <CardContent className="p-6 pt-0 space-y-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="p-1.5 rounded-md bg-green-500/10 border border-green-500/20">
                            <Calendar className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          </div>
                          <span>
                            <strong className="text-foreground">Issued:</strong>{' '}
                            {formatDateOnly(cert.issueDate)}
                          </span>
                        </div>

                        {cert.expiryDate && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                              <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span>
                              <strong className="text-foreground">Expires:</strong>{' '}
                              {formatDateOnly(cert.expiryDate)}
                            </span>
                          </div>
                        )}

                        {cert.credentialId && (
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 shrink-0">
                              <Hash className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs break-all font-mono">
                              <strong className="text-foreground font-sans">ID:</strong>{' '}
                              {cert.credentialId}
                            </span>
                          </div>
                        )}
                      </div>

                      {cert.description && (
                        <>
                          <Separator />
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {cert.description}
                          </p>
                        </>
                      )}

                      {cert.skills && cert.skills.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                                <Code2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <h4 className="text-xs text-foreground font-semibold uppercase tracking-wider">
                                Skills
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {cert.skills.map((skill: string) => (
                                <Badge
                                  key={skill}
                                  variant="secondary"
                                  className="px-3 py-1 text-xs font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200"
                                >
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {cert.credentialUrl && (
                        <>
                          <Separator />
                          <Link
                            href={cert.credentialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors group/link font-medium"
                          >
                            <ExternalLink className="h-4 w-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform duration-200" />
                            <span className="group-hover/link:underline">View Certificate</span>
                          </Link>
                        </>
                      )}
                    </CardContent>
                  </MagicCard>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card/30 backdrop-blur-sm border-border/50 p-8">
              <p className="text-muted-foreground text-center">
                No certifications listed from this issuer yet.
              </p>
            </Card>
          )}
        </section>
      ))}

      {Object.keys(groupedCertifications).length === 0 && (
        <Card className="bg-card/30 backdrop-blur-sm border-border/50 p-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted/50 border-2 border-border">
              <Award className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-xl text-muted-foreground">
              No certifications available at the moment.
            </p>
          </div>
        </Card>
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
