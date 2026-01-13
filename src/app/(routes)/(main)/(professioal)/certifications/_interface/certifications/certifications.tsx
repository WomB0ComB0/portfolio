'use client';

import { MagicCard, PageHeader } from '@/components';
import { FilterBar } from '@/components/ui/filter-bar';

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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useDebounce, useSanityCertifications } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDateOnly, validateUserInput } from '@/utils';
import { motion } from 'framer-motion';
import { Award, Building2, Calendar, Code2, ExternalLink, Hash, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';

type Certifications = ReturnType<typeof useSanityCertifications>['data'];
type CertificationItem = NonNullable<Certifications>[number];

/**
 * Skeleton loader for individual certification cards
 */
const CertificationCardSkeleton = () => {
  return (
    <div className="h-full">
      <Card
        className="bg-card/40 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden h-full flex flex-col"
        aria-busy="true"
        aria-label="Loading certification"
      >
        <div className="w-full aspect-video relative bg-muted/20 animate-pulse" />

        <CardHeader className="p-6 space-y-3">
          <div className="h-7 bg-muted/20 animate-pulse rounded-lg w-3/4" />
          <div className="h-5 bg-muted/20 animate-pulse rounded-lg w-1/2" />
        </CardHeader>

        <CardContent className="p-6 pt-0 space-y-6 flex-1">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/20 animate-pulse" />
              <div className="h-5 bg-muted/20 animate-pulse rounded-lg w-2/3" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/20 animate-pulse" />
              <div className="h-5 bg-muted/20 animate-pulse rounded-lg w-3/4" />
            </div>
          </div>

          <Separator className="bg-white/5" />

          <div className="space-y-2">
            <div className="h-4 bg-muted/20 animate-pulse rounded w-full" />
            <div className="h-4 bg-muted/20 animate-pulse rounded w-full" />
            <div className="h-4 bg-muted/20 animate-pulse rounded w-2/3" />
          </div>

          <div className="space-y-3 mt-auto">
            <div className="h-5 bg-muted/20 animate-pulse rounded w-24" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skill-skeleton-${Number(i)}`}
                  className="h-7 w-20 bg-muted/20 animate-pulse rounded-full"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Full loading skeleton for certifications page
 */
const CertificationsPageSkeleton = () => {
  return (
    <output className="block space-y-16" aria-label="Loading certifications">
      <PageHeader
        title="My Certifications"
        description="A collection of my professional certifications and credentials."
        icon={<Award />}
      />

      {/* Filter Bar Skeleton */}
      <div className="h-16 bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl animate-pulse" />

      {Array.from({ length: 2 }).map((_, sectionIdx) => (
        <section key={`section-skeleton-${Number(sectionIdx)}`} className="space-y-8">
          <div className="flex items-center gap-4 p-6 bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl">
            <div className="h-10 w-10 rounded-xl bg-muted/20 animate-pulse" />
            <div className="h-8 bg-muted/20 animate-pulse rounded-lg w-48" />
            <div className="h-7 bg-muted/20 animate-pulse rounded-full w-24 ml-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <CertificationCardSkeleton key={`cert-skeleton-${Number(i)}`} />
            ))}
          </div>
        </section>
      ))}
    </output>
  );
};

/**
 * Animation variants for certification cards
 */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/**
 * Skills badges component - extracted to reduce nesting depth
 */
const CertificationSkillBadges = ({ skills }: { skills: readonly string[] }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.slice(0, 5).map((skill: string) => (
        <Badge
          key={skill}
          variant="secondary"
          className="px-2.5 py-1 text-[10px] font-medium bg-white/5 hover:bg-primary/10 hover:text-primary border-white/10 transition-colors"
        >
          {skill}
        </Badge>
      ))}
      {skills.length > 5 && (
        <Badge
          variant="outline"
          className="px-2.5 py-1 text-[10px] border-white/10 text-muted-foreground"
        >
          +{skills.length - 5} more
        </Badge>
      )}
    </div>
  );
};

/**
 * Individual certification card component - extracted to reduce nesting depth
 */
const CertificationCard = ({ cert }: { cert: CertificationItem }) => {
  return (
    <motion.div key={cert._id} variants={itemVariants} className="h-full w-full">
      <MagicCard className="bg-card/40 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden h-full transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 group">
        <div className="flex flex-col h-full">
          {/* Image Section */}
          <div className="relative w-full aspect-video overflow-hidden bg-muted/20">
            {cert.image ? (
              <Image
                src={
                  urlFor(cert.image.asset._ref).width(800).height(450).url() ||
                  '/placeholder.svg?height=450&width=800'
                }
                alt={cert.image?.alt || `${cert.title} certification badge`}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/10">
                <Award className="h-12 w-12 text-muted-foreground/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
          </div>

          <CardHeader className="p-6 space-y-2 relative">
            <CardHeader className="p-0">
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight line-clamp-2">
                {cert.title}
              </h3>
            </CardHeader>
          </CardHeader>

          <CardContent className="p-6 pt-0 space-y-6 flex-1 flex flex-col">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground group/date">
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0 transition-colors group-hover/date:bg-green-500/20">
                  <Calendar className="h-4 w-4 text-green-500" aria-hidden="true" />
                </div>
                <span className="leading-relaxed">
                  <span className="block text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                    Issued
                  </span>
                  <time dateTime={cert.issueDate} className="text-foreground font-medium">
                    {formatDateOnly(cert.issueDate)}
                  </time>
                </span>
              </div>

              {cert.expiryDate && (
                <div className="flex items-center gap-3 text-muted-foreground group/date">
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0 transition-colors group-hover/date:bg-orange-500/20">
                    <Calendar className="h-4 w-4 text-orange-500" aria-hidden="true" />
                  </div>
                  <span className="leading-relaxed">
                    <span className="block text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                      Expires
                    </span>
                    <time dateTime={cert.expiryDate} className="text-foreground font-medium">
                      {formatDateOnly(cert.expiryDate)}
                    </time>
                  </span>
                </div>
              )}

              {cert.credentialId && (
                <div className="flex items-start gap-3 text-muted-foreground group/id">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0 transition-colors group-hover/id:bg-blue-500/20">
                    <Hash className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                      Credential ID
                    </span>
                    <span className="text-xs font-mono text-foreground break-all">
                      {cert.credentialId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {cert.description && (
              <>
                <Separator className="bg-white/5" />
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {cert.description}
                </p>
              </>
            )}

            <div className="mt-auto space-y-6">
              {cert.skills && cert.skills.length > 0 && (
                <>
                  <Separator className="bg-white/5" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-primary/70" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Skills
                      </span>
                    </div>
                    <CertificationSkillBadges skills={cert.skills} />
                  </div>
                </>
              )}

              {cert.credentialUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="w-full bg-transparent hover:bg-transparent hover:text-primary-foreground border-white/10 hover:border-primary transition-all duration-300 group/btn"
                >
                  <Link
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <span className="text-white">View Certificate</span>
                    <ExternalLink className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-300 text-white" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </MagicCard>
    </motion.div>
  );
};

/**
 * Displays a grouped list of professional certifications retrieved from Sanity.
 */
const CertificationsContent = () => {
  const { data: certifications } = useSanityCertifications();
  const [selectedIssuer, setSelectedIssuer] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  /**
   * Extract unique issuers for filter dropdown
   */
  const uniqueIssuers = useMemo(() => {
    if (!certifications) return [];
    const issuers = new Set(certifications.map((cert) => cert.issuer || 'General'));
    return Array.from(issuers).sort();
  }, [certifications]);

  /**
   * Extract unique skills for filter dropdown
   */
  const uniqueSkills = useMemo(() => {
    if (!certifications) return [];
    const skills = new Set<string>();
    for (const cert of certifications) {
      if (cert.skills) {
        for (const skill of cert.skills) {
          const splitSkills = skill
            .split(/[\n•·]/)
            .map((s) => s.trim())
            .filter(Boolean);
          for (const s of splitSkills) {
            skills.add(s);
          }
        }
      }
    }
    return Array.from(skills).sort();
  }, [certifications]);

  /**
   * Filter certifications based on selected filters
   */
  const filteredCertifications = useMemo(() => {
    if (!certifications) return [];
    return certifications.filter((cert) => {
      if (selectedIssuer !== 'all' && cert.issuer !== selectedIssuer) {
        return false;
      }
      if (selectedSkill !== 'all') {
        if (!cert.skills) return false;
        const certSkills = cert.skills.flatMap((skill) =>
          skill
            .split(/[\n•·]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        if (!certSkills.includes(selectedSkill)) {
          return false;
        }
      }
      const sanitizedQuery = validateUserInput(debouncedSearchQuery, 100).toLowerCase();
      if (sanitizedQuery) {
        const matchesTitle = cert.title.toLowerCase().includes(sanitizedQuery);
        const matchesIssuer = cert.issuer?.toLowerCase().includes(sanitizedQuery);
        const matchesDescription = cert.description?.toLowerCase().includes(sanitizedQuery);
        const matchesSkills = cert.skills?.some((s) => s.toLowerCase().includes(sanitizedQuery));
        if (!matchesTitle && !matchesIssuer && !matchesDescription && !matchesSkills) {
          return false;
        }
      }
      return true;
    });
  }, [certifications, selectedIssuer, selectedSkill, debouncedSearchQuery]);

  /**
   * Groups filtered certifications by issuer/category
   */
  const groupedCertifications = useMemo(() => {
    return filteredCertifications.reduce(
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
  }, [filteredCertifications]);

  const hasActiveFilters =
    selectedIssuer !== 'all' || selectedSkill !== 'all' || searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setSelectedIssuer('all');
    setSelectedSkill('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-16">
      <PageHeader
        title="My Certifications"
        description="A collection of my professional certifications and credentials."
        icon={<Award />}
      />

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search certifications..."
        filters={[
          {
            value: selectedIssuer,
            onChange: setSelectedIssuer,
            options: uniqueIssuers,
            placeholder: 'All Issuers',
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            value: selectedSkill,
            onChange: setSelectedSkill,
            options: uniqueSkills,
            placeholder: 'All Skills',
            icon: <Code2 className="h-4 w-4" />,
          },
        ]}
        onClear={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        resultsCount={filteredCertifications.length}
        totalCount={certifications?.length || 0}
        entityName="certifications"
      />

      {Object.entries(groupedCertifications).map(([issuer, certs]) => (
        <motion.section
          key={issuer}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
          aria-labelledby={`issuer-${issuer.replaceAll(/\s+/g, '-').toLowerCase()}`}
        >
          <div className="flex items-center gap-4 p-6 bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl shadow-sm">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h2
              id={`issuer-${issuer.replaceAll(/\s+/g, '-').toLowerCase()}`}
              className="text-2xl font-bold text-foreground tracking-tight"
            >
              {issuer}
            </h2>
            <Badge
              variant="secondary"
              className="ml-auto text-sm px-3 py-1 bg-white/5 border-white/10"
            >
              {certs.length} {certs.length === 1 ? 'Certification' : 'Certifications'}
            </Badge>
          </div>

          {certs.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-8 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]"
            >
              {certs.map((cert) => {
                if (!cert) return null;
                return <CertificationCard key={cert._id} cert={cert} />;
              })}
            </motion.div>
          ) : (
            <Card className="bg-card/30 backdrop-blur-sm border-white/5 p-8 rounded-3xl">
              <p className="text-muted-foreground text-center leading-relaxed">
                No certifications listed from this issuer yet.
              </p>
            </Card>
          )}
        </motion.section>
      ))}

      {Object.keys(groupedCertifications).length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 px-4 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 ring-1 ring-white/10">
            {hasActiveFilters ? (
              <Search className="h-10 w-10 text-muted-foreground" />
            ) : (
              <Award className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {hasActiveFilters ? 'No matches found' : 'No certifications found'}
          </h3>
          <p className="text-muted-foreground max-w-md mb-8">
            {hasActiveFilters
              ? "We couldn't find any certifications matching your current filters. Try adjusting your search criteria."
              : "It looks like I haven't added any certifications yet. Check back soon!"}
          </p>
          {hasActiveFilters && (
            <Button
              onClick={clearAllFilters}
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </motion.div>
      )}
    </div>
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
