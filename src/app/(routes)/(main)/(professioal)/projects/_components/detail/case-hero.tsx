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
 * @file The project page's header (Story's case-study hero on Folio's QuietStage), rendered on
 * the server: the breadcrumb (Projects / year, or Projects / Featured, which leads to the
 * project's own story in the Featured chapter),
 * the kind, the title at display size with its subtitle, the description, When / Length /
 * Status, Visit and Source, and beside it the cover.
 * The title's size is the smallest of a rem clamp and its column's width over its widest word
 * (--folio-fit), so enlarged text never lets it break mid-word or eat the screen.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactElement } from 'react';

import { Byline, QuietStage } from '@/components/console/folio';
import type { Project } from '@/hooks/sanity/schemas';
import { kindsOf } from '../../_lib/project-text';
import { Prose } from './breakable';
import { CaseCover, CasePlate } from './case-cover';
import { CaseFacts, CaseLinks } from './case-facts';
import styles from './case-hero.module.css';
import type { Screen } from './case-screens';
import {
  type CaseCrumb,
  caseCrumb,
  caseStatus,
  caseTitle,
  isOngoing,
  lengthText,
  safeHref,
  siteHost,
  whenText,
} from './case-text';

export const CASE_TITLE_ID = 'project-title';

export interface CaseHeroProps {
  readonly project: Project;
  readonly screens: readonly Screen[];
  /** Whether /projects lists it in the Featured chapter (then not under its year). */
  readonly featured: boolean;
}

/**
 * Projects / 2024, or Projects / Featured: back to the list, and to where it lists the project
 * (its year's chapter, or its own story among the Featured).
 */
function Crumbs({ crumb }: { readonly crumb: CaseCrumb | null }): ReactElement {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol className={styles['crumb-list']}>
        <li>
          <Link href="/projects" className={styles.crumb}>
            <ArrowLeft aria-hidden="true" className={styles['crumb-arrow']} />
            Projects
          </Link>
        </li>
        {crumb === null ? null : (
          <li className={styles['crumb-item']}>
            <span aria-hidden="true" className={styles['crumb-sep']}>
              /
            </span>
            <Link href={crumb.href} className={styles.crumb}>
              {crumb.label}
            </Link>
          </li>
        )}
      </ol>
    </nav>
  );
}

/** The h1: the name at display size, the subtitle under it in the same heading. */
function CaseHeading({ title }: { readonly title: string }): ReactElement {
  const { name, subtitle, fit } = caseTitle(title);
  return (
    <h1
      id={CASE_TITLE_ID}
      className={styles.title}
      style={{ '--folio-fit': String(fit) } as CSSProperties}
    >
      {name}
      {subtitle ? (
        <span className={styles.subtitle}>
          {/* The space is outside the hidden colon: some name engines trim one inside it. */}
          <span className="sr-only">:</span> {subtitle}
        </span>
      ) : null}
    </h1>
  );
}

/** The header: breadcrumb, then the words beside the cover (or the description as the plate). */
export function CaseHero({ project, screens, featured }: CaseHeroProps): ReactElement {
  const live = safeHref(project.liveUrl);
  const host = live ? siteHost(live) : null;
  const ongoing = isOngoing(project.status);
  const hasImage = screens.length > 0;
  return (
    <QuietStage as="header" aria-labelledby={CASE_TITLE_ID} className={styles.stage}>
      <Crumbs crumb={caseCrumb(project._id, project.startDate, featured)} />
      <div className={styles.hero} data-has-image={hasImage ? 'true' : 'false'}>
        <div className={styles.intro}>
          <Byline parts={kindsOf(project.category)} className={styles.kind} />
          <CaseHeading title={project.title} />
          {hasImage ? (
            <p className={styles.lede}>
              <Prose text={project.description} />
            </p>
          ) : null}
          <CaseFacts
            when={whenText(project.startDate, project.endDate, ongoing)}
            length={ongoing ? null : lengthText(project.startDate, project.endDate)}
            status={caseStatus(project.status)}
          />
          <CaseLinks live={live} host={host} source={safeHref(project.githubUrl)} />
        </div>
        {hasImage ? (
          <CaseCover screens={screens} host={host} />
        ) : (
          <CasePlate text={project.description} />
        )}
      </div>
    </QuietStage>
  );
}
