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
 * @file A project's page body: Story's case study on Folio's quiet stage, the owner's pick of
 * 2026-11-15, rendered on the server from the project the page loaded:
 * - the header (case-hero.tsx): breadcrumb (to the project's year on /projects, or to Featured),
 *   kind, the title at display size with its subtitle, the description, When / Length / Status,
 *   Visit and Source, and the cover in a browser frame with the next screen peeking behind it, on
 *   the QuietStage light instead of a blurred copy;
 * - 'Where it sits' (where-it-sits.tsx): its place on one time line, between named neighbours;
 * - the case study (case-study.tsx): only sections Studio has text for; How it fits together
 *   holds a multi-repository project's parts (project-parts.ts resolves a part's page link
 *   against the project list the page already loads, so there is no extra fetch); Screens holds
 *   every screen but the cover the header already shows, as one figure, a strip or a contact
 *   sheet; Built with lists the main technologies first, then those only a part has, so a ?tech=
 *   link from /projects always lands on a page that shows that technology;
 * - whatever the page adds (its children: See also), and "Back to all projects" last.
 * Every image is a link to the whole image; the shared viewer (src/components/console/photo) is
 * the only client code and opens them in the /places dialog's look. Nothing animates in, so the
 * server HTML reads as soon as it arrives, with or without JavaScript.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { PhotoViewerRoot } from '@/components/console/photo/photo-viewer';
import { PortfolioMedia } from '@/components/portfolio-media';
import bodyStyles from '../../_components/detail/case-body.module.css';
import { CaseHero } from '../../_components/detail/case-hero';
import { viewerItems } from '../../_components/detail/case-images';
import { projectLine } from '../../_components/detail/case-line';
import { screensOf } from '../../_components/detail/case-screens';
import { CaseStudy } from '../../_components/detail/case-study';
import { caseTitle } from '../../_components/detail/case-text';
import { WhereItSits } from '../../_components/detail/where-it-sits';
import { featuredOf } from '../../_lib/project-order';
import { allTechnologiesOf, caseSystemOf } from '../../_lib/project-parts';
import type { ProjectDetailProps } from './project-detail.types';

const BACK_LABEL = 'Back to all projects';

const SCREEN_NOUN = { one: 'screen', many: 'screens' } as const;

/** The project page: header, where it sits, the case study, See also, and the way back. */
export function ProjectDetail({ project, projects, children }: ProjectDetailProps): ReactElement {
  const screens = screensOf(project);
  const all = projects ?? [project];
  const line = projectLine(project._id, all);
  const featured = featuredOf(all).some((each) => each._id === project._id);
  const system = caseSystemOf(project, all);
  return (
    <PhotoViewerRoot
      items={viewerItems(screens)}
      title={caseTitle(project.title).name}
      noun={SCREEN_NOUN}
    >
      <article className="px-(--page-gutter)" data-project-page="">
        <CaseHero project={project} screens={screens} featured={featured} />
        <WhereItSits line={line} />
        <CaseStudy
          longDescription={project.longDescription}
          technologies={allTechnologiesOf(project)}
          screens={screens}
          system={system}
        />
        <div className={bodyStyles.after}>
          <PortfolioMedia id="project-media" media={project.media} />
          {children}
          <Link href="/projects" prefetch={false} className={bodyStyles.back}>
            <ArrowLeft aria-hidden="true" className={bodyStyles['back-arrow']} />
            {BACK_LABEL}
          </Link>
        </div>
      </article>
    </PhotoViewerRoot>
  );
}
