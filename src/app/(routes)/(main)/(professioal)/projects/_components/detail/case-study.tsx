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
 * @file The case study (Story's rail), server-rendered: a hairline with a stop for each section
 * and the section's name in the margin. Only real text makes a section, and one without its
 * source text is left out, never written for the owner:
 * - The project: Studio's long description, its first sentence set as the lead when it has more
 *   than one, or Studio's own bullet list;
 * - Screens: every screen but the cover the header shows, as a figure, a strip or a contact
 *   sheet; none for a project with one image or none (the header then holds it all);
 * - Built with: the technologies as a word list (no pills), each a link to /projects filtered by it;
 *   a hyphenated or slashed word in a name ('Speech-to-Text') or a long address moves whole to the
 *   next line whenever it fits there, and splits only when it is wider than the column.
 */

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { breaksInside, WholeWords } from '@/components/console/photo/whole-words';
import { Prose } from './breakable';
import styles from './case-body.module.css';
import { type Screen, screensLayout, sectionScreens } from './case-screens';
import { type CaseBody, caseBody, leadSplit, proseRuns } from './case-text';
import { ScreensSheet } from './screens-sheet';

export const SCREENS_ID = 'screens';

export interface CaseStudyProps {
  readonly longDescription: string | null | undefined;
  readonly technologies: readonly string[];
  readonly screens: readonly Screen[];
}

interface CaseSectionProps {
  readonly id: string;
  readonly label: string;
  readonly wide?: boolean;
  readonly children: ReactNode;
}

/** One stop on the rail: its name in the margin, its content beside it. */
function CaseSection({ id, label, wide = false, children }: CaseSectionProps): ReactElement {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={styles.section}
      data-case-section={id}
    >
      <h2 id={`${id}-title`} className={styles.label}>
        {label}
      </h2>
      <div className={wide ? styles['body-wide'] : styles.body}>{children}</div>
    </section>
  );
}

/** Studio's long description: paragraphs (the first sentence as the lead) or its bullet list. */
function ProjectText({ body }: { readonly body: CaseBody }): ReactElement {
  if (body.kind === 'list') {
    return (
      <ul className={styles.points}>
        {body.items.map((item) => (
          <li key={item} className={styles.point}>
            <Prose text={item} />
          </li>
        ))}
      </ul>
    );
  }
  const [first = '', ...rest] = body.items;
  const split = leadSplit(first);
  return (
    <div className={styles.prose}>
      {split ? (
        <>
          <p className={styles.lead}>
            <Prose text={split.lead} />
          </p>
          <p className={styles.para}>
            <Prose text={split.rest} />
          </p>
        </>
      ) : (
        <p className={styles.para}>
          <Prose text={first} />
        </p>
      )}
      {rest.map((paragraph) => (
        <p key={paragraph} className={styles.para}>
          <Prose text={paragraph} />
        </p>
      ))}
    </div>
  );
}

/** Whether a word is a long address or path, which Prose cuts after its dots and slashes. */
const isAddress = (word: string): boolean => {
  const [run] = proseRuns(word);
  return run !== undefined && typeof run !== 'string';
};

/** A word of a technology's name held whole: one a browser could split, or a long address. */
const holdsWhole = (word: string): boolean => breaksInside(word) || isAddress(word);

const proseWord = (word: string): ReactNode => <Prose text={word} />;

/** The technologies as words, each a link to the projects built with it. */
function BuiltWith({ technologies }: { readonly technologies: readonly string[] }): ReactElement {
  return (
    <ul className={styles.techs}>
      {technologies.map((tech) => (
        <li key={tech} className={styles['tech-item']}>
          <Link
            href={`/projects?tech=${encodeURIComponent(tech)}`}
            prefetch={false}
            className={styles.tech}
          >
            {/* One flex item, so a long name's inline block keeps its spaces and the underline. */}
            <span className={styles['tech-name']}>
              <WholeWords text={tech} isWhole={holdsWhole} renderWord={proseWord} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The rail of sections; nothing when Studio holds none of their text. */
export function CaseStudy({
  longDescription,
  technologies,
  screens,
}: CaseStudyProps): ReactElement | null {
  const body = caseBody(longDescription);
  const shown = sectionScreens(screens);
  const layout = screensLayout(shown.length);
  const techs = [...new Set(technologies.map((tech) => tech.trim()).filter(Boolean))];
  if (!body && !layout && techs.length === 0) return null;
  return (
    <div className={styles.case} data-case-study="">
      {body ? (
        <CaseSection id="about" label="The project">
          <ProjectText body={body} />
        </CaseSection>
      ) : null}
      {layout ? (
        <CaseSection id={SCREENS_ID} label="Screens" wide>
          <ScreensSheet screens={shown} count={screens.length} layout={layout} />
        </CaseSection>
      ) : null}
      {techs.length > 0 ? (
        <CaseSection id="built-with" label="Built with">
          <BuiltWith technologies={techs} />
        </CaseSection>
      ) : null}
    </div>
  );
}
