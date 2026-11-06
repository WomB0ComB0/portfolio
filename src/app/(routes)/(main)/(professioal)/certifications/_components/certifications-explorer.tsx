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

/**
 * @file The certifications list's client island: search, issuer and skill filters kept in the URL
 * (?q, ?issuer, ?skill) and the certifications grouped by issuer. It gets plain card data from the
 * server with image URLs already built, so no Sanity code reaches the browser. Every card is
 * rendered (no pagination) and nothing animates in, so the server HTML shows the whole list.
 */

import { Award, Building2, Calendar, Code2, ExternalLink, Hash, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { debounce, parseAsString, useQueryStates } from 'nuqs';
import { type JSX, useMemo } from 'react';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/filter-bar';
import { Separator } from '@/components/ui/separator';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDateOnly } from '@/utils/date';
import { validateUserInput } from '@/utils/security/xss';

/** What a certification card shows, built on the server by `toCertificationCard`. */
export interface CertificationCardData {
  readonly id: string;
  readonly title: string;
  readonly issuer: string;
  /** Sanity `date` (YYYY-MM-DD). */
  readonly issueDate: string;
  readonly expiryDate: string | null;
  readonly credentialId: string | null;
  readonly credentialUrl: string | null;
  readonly description: string | null;
  /** As stored: one entry may hold several skills joined by newlines or bullets. */
  readonly skills: readonly string[];
  /** The badge at 800x450, or null to show the placeholder icon. */
  readonly imageUrl: string | null;
  readonly imageAlt: string;
}

export interface CertificationsExplorerProps {
  readonly certifications: readonly CertificationCardData[];
}

/** The filter value that shows everything. */
const ALL = 'all';
/** The group of a certification with no issuer. */
const DEFAULT_ISSUER = 'General';
const SEARCH_MAX_LENGTH = 100;
/** The search filters, and writes ?q, this long after the last keystroke. */
const SEARCH_DEBOUNCE_MS = 300;
const MAX_VISIBLE_SKILLS = 5;
/** What separates the skills the CMS stores joined in one string. */
const SKILL_SEPARATORS = /[\n•·]/;

/** The loaded grid of cards. The loading skeleton below uses it too, so the two line up. */
const CERTIFICATION_GRID_CLASS =
  'grid gap-8 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]';
const GROUP_HEADER_CLASS =
  'flex items-center gap-4 p-6 bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl';
const SKELETON_GROUPS = 2;
const SKELETON_CARDS_PER_GROUP = 3;
const SKELETON_SKILLS = 3;

/**
 * Filters in the URL. Replacing the history entry keeps Back on the page before /certifications,
 * and shallow updates filter in the browser without asking the server for the page again.
 */
const FILTER_PARSERS = {
  q: parseAsString.withDefault(''),
  issuer: parseAsString.withDefault(ALL),
  skill: parseAsString.withDefault(ALL),
};
const FILTER_URL_OPTIONS = { history: 'replace', shallow: true } as const;
const SEARCH_URL_OPTIONS = { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) } as const;
const CLEARED_FILTERS = { q: null, issuer: null, skill: null };

interface ActiveFilters {
  readonly issuer: string;
  readonly skill: string;
  /** Sanitised and lower-cased; '' matches everything. */
  readonly query: string;
}

type IssuerGroup = readonly [issuer: string, certifications: readonly CertificationCardData[]];

const issuerOf = (cert: CertificationCardData): string => cert.issuer || DEFAULT_ISSUER;

/** The certification's skills with joined strings split into their parts. */
const skillsOf = (cert: CertificationCardData): readonly string[] =>
  cert.skills.flatMap((skill) =>
    skill
      .split(SKILL_SEPARATORS)
      .map((part) => part.trim())
      .filter(Boolean),
  );

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  Array.from(new Set(values)).sort();

/** `value` when it is one of `options`, else 'all': a stale or hand-edited URL shows everything. */
const knownOrAll = (value: string, options: readonly string[]): string =>
  options.includes(value) ? value : ALL;

const matchesQuery = (cert: CertificationCardData, query: string): boolean =>
  !query ||
  cert.title.toLowerCase().includes(query) ||
  cert.issuer.toLowerCase().includes(query) ||
  Boolean(cert.description?.toLowerCase().includes(query)) ||
  cert.skills.some((skill) => skill.toLowerCase().includes(query));

const filterCertifications = (
  certifications: readonly CertificationCardData[],
  { issuer, skill, query }: ActiveFilters,
): readonly CertificationCardData[] =>
  certifications.filter(
    (cert) =>
      (issuer === ALL || issuerOf(cert) === issuer) &&
      (skill === ALL || skillsOf(cert).includes(skill)) &&
      matchesQuery(cert, query),
  );

/** Certifications grouped by issuer, the groups in the order their first certification comes. */
const groupByIssuer = (certifications: readonly CertificationCardData[]): readonly IssuerGroup[] =>
  Array.from(
    new Set(certifications.map(issuerOf)),
    (issuer): IssuerGroup => [issuer, certifications.filter((cert) => issuerOf(cert) === issuer)],
  );

const issuerHeadingId = (issuer: string): string =>
  `issuer-${issuer.replaceAll(/\s+/g, '-').toLowerCase()}`;

const CertificationSkillBadges = ({ skills }: { skills: readonly string[] }): JSX.Element => (
  <div className="flex flex-wrap gap-2">
    {skills.slice(0, MAX_VISIBLE_SKILLS).map((skill) => (
      <Badge
        key={skill}
        variant="secondary"
        className="px-2.5 py-1 text-[10px] font-medium bg-white/5 hover:bg-primary/10 hover:text-primary border-white/10 transition-colors"
      >
        {skill}
      </Badge>
    ))}
    {skills.length > MAX_VISIBLE_SKILLS && (
      <Badge
        variant="outline"
        className="px-2.5 py-1 text-[10px] border-white/10 text-muted-foreground"
      >
        +{skills.length - MAX_VISIBLE_SKILLS} more
      </Badge>
    )}
  </div>
);

const CertificationImage = ({ cert }: { cert: CertificationCardData }): JSX.Element => (
  <div className="relative w-full aspect-video overflow-hidden bg-muted/20">
    {cert.imageUrl ? (
      <Image
        src={cert.imageUrl}
        alt={cert.imageAlt}
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
);

interface CertificationDateProps {
  readonly label: string;
  readonly date: string;
  readonly tone: 'issued' | 'expires';
}

const DATE_TONES = {
  issued: {
    box: 'p-2 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0 transition-colors group-hover/date:bg-green-500/20',
    icon: 'h-4 w-4 text-green-500',
  },
  expires: {
    box: 'p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0 transition-colors group-hover/date:bg-orange-500/20',
    icon: 'h-4 w-4 text-orange-500',
  },
} as const;

/**
 * The uppercase label over a card's date or credential ID. Plain muted text: at /70 on the
 * translucent card it measured 4.54:1, and 4.44:1 under the hover spotlight, below AA's 4.5.
 */
const DETAIL_LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider';

const CertificationDate = ({ label, date, tone }: CertificationDateProps): JSX.Element => (
  <div className="flex items-center gap-3 text-muted-foreground group/date">
    <div className={DATE_TONES[tone].box}>
      <Calendar className={DATE_TONES[tone].icon} aria-hidden="true" />
    </div>
    <span className="leading-relaxed">
      <span className={DETAIL_LABEL_CLASS}>{label}</span>
      <time dateTime={date} className="text-foreground font-medium">
        {formatDateOnly(date)}
      </time>
    </span>
  </div>
);

const CertificationCredentialId = ({ credentialId }: { credentialId: string }): JSX.Element => (
  <div className="flex items-start gap-3 text-muted-foreground group/id">
    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0 transition-colors group-hover/id:bg-blue-500/20">
      <Hash className="h-4 w-4 text-blue-500" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <span className={DETAIL_LABEL_CLASS}>Credential ID</span>
      <span className="text-xs font-mono text-foreground break-all">{credentialId}</span>
    </div>
  </div>
);

const CertificationSkills = ({ skills }: { skills: readonly string[] }): JSX.Element => (
  <>
    <Separator className="bg-white/5" />
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary/70" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Skills
        </span>
      </div>
      <CertificationSkillBadges skills={skills} />
    </div>
  </>
);

const CredentialLink = ({ href }: { href: string }): JSX.Element => (
  <Button
    asChild
    variant="outline"
    className="w-full bg-transparent hover:bg-transparent hover:text-primary-foreground border-white/10 hover:border-primary transition-all duration-300 group/btn"
  >
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2"
    >
      <span className="text-white">View Certificate</span>
      <ExternalLink className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-300 text-white" />
    </Link>
  </Button>
);

const CertificationCard = ({ cert }: { cert: CertificationCardData }): JSX.Element => (
  <div className="h-full w-full">
    <MagicCard className="bg-card/40 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden h-full transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 group">
      <div className="flex flex-col h-full">
        <CertificationImage cert={cert} />

        <CardHeader className="p-6 space-y-2 relative">
          <CardHeader className="p-0">
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight line-clamp-2">
              {cert.title}
            </h3>
          </CardHeader>
        </CardHeader>

        <CardContent className="p-6 pt-0 space-y-6 flex-1 flex flex-col">
          <div className="space-y-3 text-sm">
            <CertificationDate label="Issued" date={cert.issueDate} tone="issued" />
            {cert.expiryDate && (
              <CertificationDate label="Expires" date={cert.expiryDate} tone="expires" />
            )}
            {cert.credentialId && <CertificationCredentialId credentialId={cert.credentialId} />}
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
            {cert.skills.length > 0 && <CertificationSkills skills={cert.skills} />}
            {cert.credentialUrl && <CredentialLink href={cert.credentialUrl} />}
          </div>
        </CardContent>
      </div>
    </MagicCard>
  </div>
);

interface IssuerSectionProps {
  readonly issuer: string;
  readonly certifications: readonly CertificationCardData[];
}

const IssuerSection = ({ issuer, certifications }: IssuerSectionProps): JSX.Element => (
  <section className="space-y-8" aria-labelledby={issuerHeadingId(issuer)}>
    <div className={`${GROUP_HEADER_CLASS} shadow-sm`}>
      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
        <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h2
        id={issuerHeadingId(issuer)}
        className="text-2xl font-bold text-foreground tracking-tight"
      >
        {issuer}
      </h2>
      {/* The count follows the search as it is typed; tabular-nums keeps Geist's digits steady. */}
      <Badge
        variant="secondary"
        className="ml-auto text-sm px-3 py-1 bg-white/5 border-white/10 tabular-nums"
      >
        {certifications.length} {certifications.length === 1 ? 'Certification' : 'Certifications'}
      </Badge>
    </div>

    <div className={CERTIFICATION_GRID_CLASS}>
      {certifications.map((cert) => (
        <CertificationCard key={cert.id} cert={cert} />
      ))}
    </div>
  </section>
);

interface EmptyStateProps {
  readonly hasActiveFilters: boolean;
  readonly onClear: () => void;
}

const EmptyState = ({ hasActiveFilters, onClear }: EmptyStateProps): JSX.Element => (
  <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
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
        onClick={onClear}
        variant="outline"
        className="bg-white/5 border-white/10 hover:bg-white/10"
      >
        <X className="h-4 w-4 mr-2" />
        Clear Filters
      </Button>
    )}
  </div>
);

interface FilterOptions {
  readonly issuers: readonly string[];
  readonly skills: readonly string[];
}

/** The issuer and skill options, from the full list so a filter never hides its own choices. */
function useFilterOptions(certifications: readonly CertificationCardData[]): FilterOptions {
  const issuers = useMemo(() => uniqueSorted(certifications.map(issuerOf)), [certifications]);
  const skills = useMemo(() => uniqueSorted(certifications.flatMap(skillsOf)), [certifications]);
  return { issuers, skills };
}

/**
 * Every certification, grouped by issuer, under a filter bar whose state lives in the URL. An
 * ?issuer or ?skill that is not among the options counts as 'all'.
 */
export const CertificationsExplorer = ({
  certifications,
}: CertificationsExplorerProps): JSX.Element => {
  const [filters, setFilters] = useQueryStates(FILTER_PARSERS, FILTER_URL_OPTIONS);
  const options = useFilterOptions(certifications);
  const issuer = knownOrAll(filters.issuer, options.issuers);
  const skill = knownOrAll(filters.skill, options.skills);
  const debouncedQuery = useDebounce(filters.q, SEARCH_DEBOUNCE_MS);

  const filtered = useMemo(
    () =>
      filterCertifications(certifications, {
        issuer,
        skill,
        query: validateUserInput(debouncedQuery, SEARCH_MAX_LENGTH).toLowerCase(),
      }),
    [certifications, issuer, skill, debouncedQuery],
  );
  const groups = useMemo(() => groupByIssuer(filtered), [filtered]);

  const hasActiveFilters = issuer !== ALL || skill !== ALL || filters.q.trim() !== '';
  const clearAllFilters = () => {
    setFilters(CLEARED_FILTERS);
  };

  return (
    <div className="space-y-16">
      <FilterBar
        searchQuery={filters.q}
        onSearchChange={(q) => {
          setFilters({ q }, SEARCH_URL_OPTIONS);
        }}
        searchPlaceholder="Search certifications..."
        filters={[
          {
            value: issuer,
            onChange: (value) => {
              setFilters({ issuer: value });
            },
            options: [...options.issuers],
            placeholder: 'All Issuers',
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            value: skill,
            onChange: (value) => {
              setFilters({ skill: value });
            },
            options: [...options.skills],
            placeholder: 'All Skills',
            icon: <Code2 className="h-4 w-4" />,
          },
        ]}
        onClear={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        resultsCount={filtered.length}
        totalCount={certifications.length}
        entityName="certifications"
      />

      {groups.map(([groupIssuer, certs]) => (
        <IssuerSection key={groupIssuer} issuer={groupIssuer} certifications={certs} />
      ))}

      {groups.length === 0 && (
        <EmptyState hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
      )}
    </div>
  );
};
CertificationsExplorer.displayName = 'CertificationsExplorer';

const CertificationCardSkeleton = (): JSX.Element => (
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
            {Array.from({ length: SKELETON_SKILLS }, (_, i) => (
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

/**
 * The explorer's loading state: the filter bar, then issuer headings over cards in the loaded
 * grid's columns. The page header is the caller's.
 */
export const CertificationsExplorerSkeleton = (): JSX.Element => (
  <output className="block space-y-16" aria-label="Loading certifications">
    <div className="h-16 bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl animate-pulse" />

    {Array.from({ length: SKELETON_GROUPS }, (_, group) => (
      <section key={`section-skeleton-${Number(group)}`} className="space-y-8">
        <div className={GROUP_HEADER_CLASS}>
          <div className="h-10 w-10 rounded-xl bg-muted/20 animate-pulse" />
          <div className="h-8 bg-muted/20 animate-pulse rounded-lg w-48" />
          <div className="h-7 bg-muted/20 animate-pulse rounded-full w-24 ml-auto" />
        </div>
        <div className={CERTIFICATION_GRID_CLASS}>
          {Array.from({ length: SKELETON_CARDS_PER_GROUP }, (_, card) => (
            <CertificationCardSkeleton key={`cert-skeleton-${Number(card)}`} />
          ))}
        </div>
      </section>
    ))}
  </output>
);
CertificationsExplorerSkeleton.displayName = 'CertificationsExplorerSkeleton';
