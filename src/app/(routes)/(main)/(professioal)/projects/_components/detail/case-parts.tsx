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
 * @file "How it fits together", the body of the case study's parts section (case-study.tsx puts
 * it between The project and Screens), server-rendered: Studio's lead sentence, then one row per
 * repository the project is made of, in Studio order. The rows are an unordered list because the
 * parts are parallel pieces of one system, not a sequence, and each part's name is an h3 under
 * the section's h2, so heading navigation lists them.
 *
 * - A public repository is a new-tab link named by its owner/repo, which wraps only after its
 *   slash, then "code" and "(opens in a new tab)" for screen readers, with its link-health badge
 *   beside it: the same pattern as the hero's Source (case-facts.tsx).
 * - A private repository is the plain words "Private repository": no link, badge or tooltip, so
 *   nothing focusable leads nowhere. What the row says is all that was typed: Studio never holds a
 *   private repository's address (src/sanity/schemaTypes/project-parts.ts).
 * - A part with its own page on /projects links there from its name; the link and the repository
 *   link are siblings, never nested.
 * - Technologies are plain words after a spoken "Technologies:" (Built with below links each one,
 *   and a phone would otherwise gain a 44px target per word); their middle dots are hidden.
 *
 * Palette only (case-body.module.css), nothing animates in, and no JavaScript is needed.
 */

import Link from 'next/link';
import { Fragment, type ReactElement } from 'react';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import type { CaseSystem, PartRepo, PartRow } from '../../_lib/project-parts';
import { Breakable, Prose } from './breakable';
import styles from './case-body.module.css';
import { addressParts } from './case-text';

const PRIVATE_LABEL = 'Private repository';
const MINE_LABEL = 'My part';

/** A public repository: its owner/repo as a new-tab link, then its link-health badge. */
function RepoLink({ repo }: { readonly repo: PartRepo }): ReactElement {
  return (
    <span className={styles['part-link']}>
      <a
        href={repo.href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles['part-repo']}
        data-case-part-link="repo"
      >
        <span className={styles['part-repo-words']}>
          <Breakable parts={addressParts(repo.label)} />
          <SrOnlyWords>code</SrOnlyWords>
          <NewTabArrow />
        </span>
        <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
      </a>
      <LinkHealthBadge href={repo.href} scope="projects" />
    </span>
  );
}

/**
 * The part's own technologies as words. The spaces sit outside the hidden dots, so a screen
 * reader still hears each word apart.
 */
function PartTechs({ technologies }: { readonly technologies: readonly string[] }): ReactElement {
  return (
    <span className={styles['part-techs']} data-case-part-techs="">
      <span className="sr-only">Technologies: </span>
      {technologies.map((tech, index) => (
        <Fragment key={tech}>
          {index > 0 ? (
            <>
              {' '}
              <span aria-hidden="true">·</span>{' '}
            </>
          ) : null}
          {tech}
        </Fragment>
      ))}
    </span>
  );
}

/** The part's name, a link to its own page when it has one on /projects. */
function PartName({ part }: { readonly part: PartRow }): ReactElement {
  return (
    <h3 className={styles['part-name']}>
      {part.page ? (
        <Link
          href={part.page}
          prefetch={false}
          className={styles['part-page']}
          data-case-part-link="page"
        >
          {part.name}
          <span aria-hidden="true" className={styles['part-arrow']}>
            {' →'}
          </span>
        </Link>
      ) : (
        part.name
      )}
    </h3>
  );
}

/** One part: its name, its role, its repository and technologies, and "My part". */
function PartItem({ part }: { readonly part: PartRow }): ReactElement {
  const hasMeta = part.repo !== null || part.isPrivate || part.technologies.length > 0;
  return (
    <li className={styles.part} data-case-part="" data-case-part-key={part.key}>
      <PartName part={part} />
      {part.role ? (
        <p className={styles['part-role']}>
          <Prose text={part.role} />
        </p>
      ) : null}
      {hasMeta ? (
        <p className={styles['part-meta']} data-case-part-meta="">
          {part.repo ? <RepoLink repo={part.repo} /> : null}
          {part.isPrivate ? <span className={styles['part-private']}>{PRIVATE_LABEL}</span> : null}
          {part.technologies.length > 0 ? <PartTechs technologies={part.technologies} /> : null}
        </p>
      ) : null}
      {part.contribution ? (
        <p className={styles['part-mine']} data-case-part-mine="">
          <span className={styles['lead-in']}>{MINE_LABEL}</span> <Prose text={part.contribution} />
        </p>
      ) : null}
    </li>
  );
}

/** The section's body: the lead sentence when Studio has one, then a row per part. */
export function CaseParts({ system }: { readonly system: CaseSystem }): ReactElement {
  return (
    <>
      {system.summary ? (
        <p className={styles['parts-lead']} data-case-parts-lead="">
          <Prose text={system.summary} />
        </p>
      ) : null}
      <ul className={styles.parts} data-case-parts="">
        {system.parts.map((part) => (
          <PartItem key={part.key} part={part} />
        ))}
      </ul>
    </>
  );
}
