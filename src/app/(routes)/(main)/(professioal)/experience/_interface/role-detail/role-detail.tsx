import 'server-only';

/**
 * Copyright 2026 Mike Odnis
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
 * @file One role on /experience/[id], rendered on the server: "this role on the clock, then what
 * it was". The PageShell header (the organization as the eyebrow, with its mark and a link to
 * its site in a new tab when Studio has an http(s) one; the position as the one h1; the period,
 * the length and the place; "All experience" in the actions, which leads back to the role's own
 * row on the list, or to the list's top for the lead, which has no row), then:
 *
 * - the clock tile: the role's months among every other role's, to scale (role-context.tsx);
 * - the whole description, without its raw addresses, and the duties it does not already state;
 * - beside them from a 64rem page, the addresses as named link chips and the technologies as
 *   tokens that link into /projects where a project has one (role-row-parts.tsx, the parts the
 *   list's opened row shows);
 * - the roles that ran alongside, and the roles before and after it in the list's order.
 *
 * The role content is in the first HTML and reads without JavaScript. Small client parts add
 * link health, logo failure fallback and a guard for a Back onto a list entry the router never stamped
 * (role-list-entry-guard.tsx; the list attaches the same guard for every page after it). The
 * model is the list's own (role-page.ts on role-index.ts), so both pages draw one clock. The day
 * is passed in by the page (request-day.ts), never read below this point. Palette tokens only.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { NEW_TAB_LABEL, NewTabArrow, PageShell, SrOnlyWords } from '@/components/console';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import { PortfolioMedia } from '@/components/portfolio-media';
import type { Experience, Project } from '@/hooks/sanity/schemas';
import { RoleClockTile, RoleCompanions, RoleSteps } from '../../_components/role-context';
import { RoleDetailLogo } from '../../_components/role-detail-logo';
import { axisStyle } from '../../_components/role-lane';
import { RoleListEntryGuard } from '../../_components/role-list-entry-guard';
import { RolePeriodText } from '../../_components/role-parts';
import { RoleProgression } from '../../_components/role-progression';
import {
  RoleLengthFigure,
  RoleLinkChips,
  RoleTechTokens,
  withKeys,
} from '../../_components/role-row-parts';
import type { RoleRow } from '../../_lib/role-index';
import { EXPERIENCE_PATH } from '../../_lib/role-ledger';
import type { RoleLink } from '../../_lib/role-links';
import { roleLogoOf } from '../../_lib/role-logo';
import { buildRolePage } from '../../_lib/role-page';
import { buildTechLinks, NO_TECH_LINKS } from '../../_lib/role-tech';

const BACK_LABEL = 'All experience';
const DUTIES_LABEL = 'What I did';
const LINKS_LABEL = 'Links';
const TECH_LABEL = 'Technologies';
const HTTP_URL = /^https?:\/\//iu;
const GITHUB_URL = /^https:\/\/(?:www\.)?github\.com\//iu;

const ORG_CLASS = 'group/org inline-flex max-w-full items-center gap-2 align-bottom';
/**
 * On a touch screen the link's target reaches 44px without its 20px line growing: an overlay
 * 12px past it, above and below (nothing else there can be tapped: the h1 is under it).
 */
const ORG_TOUCH_CLASS =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3 pointer-coarse:after:content-['']";
const ORG_LINK_CLASS = `${ORG_CLASS} ${ORG_TOUCH_CLASS} rounded-sm text-muted-foreground underline-offset-4 transition-colors duration-(--motion-fast) ease-effect hover:text-foreground hover:underline`;
const ORG_NAME_CLASS = 'min-w-0 [overflow-wrap:anywhere]';
const FACTS_CLASS = 'tabular-nums';
const FACT_LENGTH_CLASS = '[&_span]:font-normal [&_span]:text-inherit';
const BACK_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 tile-label text-muted-foreground no-underline shadow-[inset_0_0_0_1px_var(--hairline)] transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-1 hover:text-foreground pointer-coarse:h-11';
/** The page's parts, a step apart; the axis's variables sit here for the clock tile. */
const PAGE_CLASS = 'flex min-w-0 flex-col gap-8 @min-[40rem]/page:gap-10';
/** The words, then the links and technologies beside them from a 64rem page. */
const BODY_CLASS =
  'grid gap-8 @min-[64rem]/page:grid-cols-[minmax(0,1fr)_20rem] @min-[64rem]/page:gap-x-14';
const MAIN_CLASS = 'flex min-w-0 flex-col gap-8';
const SIDE_CLASS = 'flex min-w-0 flex-col gap-8';
/** The description: the page's lede, a step over body text, every sentence of it. */
const LEDE_CLASS =
  'max-w-[62ch] text-[1.125rem] leading-[1.75rem] text-pretty text-foreground [overflow-wrap:anywhere] @min-[40rem]/page:text-[1.25rem] @min-[40rem]/page:leading-[1.875rem] @min-[40rem]/page:tracking-[-0.01em]';
const SECTION_CLASS = 'flex min-w-0 flex-col gap-3';
const SECTION_TITLE_CLASS = 'border-b border-hairline-strong pb-2 tile-title text-foreground';
/** A duty's rule runs the column, as its section's heading rule does; its text keeps the measure. */
const DUTY_CLASS = 'border-b border-hairline py-3 text-body text-muted-foreground first:pt-0';
const DUTY_TEXT_CLASS = 'block max-w-[68ch] text-pretty [overflow-wrap:anywhere]';

/**
 * The organization, named as the list names it: a link to its site in a new tab
 * when Studio has an http(s) one, else text.
 */
function Organization({ role }: { readonly role: RoleRow }): ReactElement {
  const name = (
    <span data-role-organization="" className={ORG_NAME_CLASS}>
      {role.organization}
    </span>
  );
  if (!role.companyUrl || !HTTP_URL.test(role.companyUrl)) {
    return <span className={ORG_CLASS}>{name}</span>;
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
      <a
        href={role.companyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={ORG_LINK_CLASS}
      >
        {name}
        {GITHUB_URL.test(role.companyUrl) ? (
          <span className="tile-meta font-normal text-faint">GitHub organization</span>
        ) : null}
        <NewTabArrow />
        <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
      </a>
      <LinkHealthBadge href={role.companyUrl} scope="experience" />
    </span>
  );
}

/** 'Jan 2024 – Present · 2 yrs 11 mos · New York, NY', each part only when there is one. */
function Facts({ role }: { readonly role: RoleRow }): ReactElement {
  const parts: { readonly key: string; readonly node: ReactNode }[] = [
    { key: 'period', node: <RolePeriodText period={role.period} /> },
    ...(role.length
      ? [
          {
            key: 'length',
            node: <RoleLengthFigure length={role.length} className={FACT_LENGTH_CLASS} />,
          },
        ]
      : []),
    ...(role.employmentType ? [{ key: 'employment-type', node: role.employmentType }] : []),
    ...(role.location ? [{ key: 'location', node: role.location }] : []),
  ];
  return (
    <span data-role-facts="" className={FACTS_CLASS}>
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {index > 0 && <span className="sr-only select-none">, </span>}
          {part.node}
        </span>
      ))}
      {role.dateNote ? (
        <span
          data-role-date-note=""
          className="mt-2 block max-w-[68ch] text-body-sm text-muted-foreground [overflow-wrap:anywhere]"
        >
          {role.dateNote}
        </span>
      ) : null}
    </span>
  );
}

/** A section heading over a hairline, as the list's column labels sit over theirs. */
function SectionTitle({ id, children }: { readonly id: string; readonly children: string }) {
  return (
    <h2 id={id} className={SECTION_TITLE_CLASS}>
      {children}
    </h2>
  );
}

export interface RoleDetailProps {
  /** The experience the page found for its id; the page answers 404 before rendering none. */
  readonly experience: Experience;
  /** Every experience: the clock, the roles alongside and the steps are read from them all. */
  readonly experiences: readonly Experience[];
  /**
   * The projects, for the technology tokens' links into /projects; null when they could not be
   * loaded, and every token is then plain text.
   */
  readonly projects: readonly Project[] | null;
  /** The day the page is rendered for, YYYY-MM-DD (the page's nyToday()). */
  readonly today: string;
}

/** One role: where it sits on the clock, then what it was. */
export function RoleDetail({
  experience,
  experiences,
  projects,
  today,
}: RoleDetailProps): ReactElement | null {
  // A role Sanity answered by id that the list does not hold yet still gets its page.
  const everyRole = experiences.some((each) => each._id === experience._id)
    ? experiences
    : [...experiences, experience];
  const page = buildRolePage(everyRole, experience._id, {
    today,
    logoOf: (source) =>
      roleLogoOf(source, { variant: source._id === experience._id ? 'detail' : 'list' }),
    techLinks: projects ? buildTechLinks(projects) : NO_TECH_LINKS,
  });
  if (!page) return null;
  const { role } = page;
  const duties = withKeys(role.duties);
  const organizationLink: RoleLink | null =
    role.companyUrl && GITHUB_URL.test(role.companyUrl)
      ? {
          href: role.companyUrl,
          label: 'GitHub organization',
          host: 'github.com',
          token: false,
        }
      : null;
  const sideLinks = organizationLink
    ? [organizationLink, ...role.links].filter(
        (link, index, links) =>
          links.findIndex((candidate) => candidate.href === link.href) === index,
      )
    : role.links;
  const hasSide = sideLinks.length > 0 || role.tech.length > 0;

  return (
    <PageShell
      headerMedia={<RoleDetailLogo src={role.logo} monogram={role.monogram} />}
      eyebrow={<Organization role={role} />}
      title={role.role}
      description={<Facts role={role} />}
      actions={
        <Link href={page.listHref} prefetch={false} className={BACK_CLASS}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {BACK_LABEL}
        </Link>
      }
    >
      <div data-role-clock="" className={PAGE_CLASS} style={axisStyle(page.axis)}>
        <RoleClockTile page={page} />
        <RoleProgression id="role-progression" subRoles={role.subRoles} />
        <div className={hasSide ? BODY_CLASS : undefined}>
          <div className={MAIN_CLASS}>
            {page.description && (
              <p data-role-description="" className={LEDE_CLASS}>
                {page.description}
              </p>
            )}
            {duties.length > 0 && (
              <section aria-labelledby="role-work" className={SECTION_CLASS}>
                <SectionTitle id="role-work">{DUTIES_LABEL}</SectionTitle>
                <ul data-role-duties="">
                  {duties.map(({ key, text }) => (
                    <li key={key} className={DUTY_CLASS}>
                      <span className={DUTY_TEXT_CLASS}>{text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {hasSide && (
            <aside className={SIDE_CLASS}>
              {sideLinks.length > 0 && (
                <section aria-labelledby="role-links" className={SECTION_CLASS}>
                  <SectionTitle id="role-links">{LINKS_LABEL}</SectionTitle>
                  <RoleLinkChips links={sideLinks} />
                </section>
              )}
              {role.tech.length > 0 && (
                <section aria-labelledby="role-tech" className={SECTION_CLASS}>
                  <SectionTitle id="role-tech">{TECH_LABEL}</SectionTitle>
                  <RoleTechTokens tech={role.tech} />
                </section>
              )}
            </aside>
          )}
        </div>
        <PortfolioMedia id="experience-media" media={experience.media} />
        <RoleCompanions companions={page.alongside} />
        <RoleSteps previous={page.previous} next={page.next} />
        <RoleListEntryGuard listPath={EXPERIENCE_PATH} />
      </div>
    </PageShell>
  );
}
RoleDetail.displayName = 'RoleDetail';
