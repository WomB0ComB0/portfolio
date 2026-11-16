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
 * @file The hero's facts and links, server-rendered: When, Length and Status as a short
 * definition list (each only when Studio holds it), then Visit (the live site, named by its real
 * address, which wraps only at its dots) and Source. Both open in a new tab and say so to screen
 * readers. Sentence case, Geist sans with tabular figures; the status dot only beside work in
 * progress, always with its word.
 */

import { Code } from 'lucide-react';
import type { ReactElement } from 'react';

import { StatusDot } from '@/components/console/status-dot';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { Breakable } from './breakable';
import styles from './case-hero.module.css';
import { addressParts, type CaseStatus } from './case-text';

export interface CaseFactsProps {
  readonly when: string | null;
  readonly length: string | null;
  readonly status: CaseStatus | null;
}

/** When / Length / Status; nothing when Studio holds none of them. */
export function CaseFacts({ when, length, status }: CaseFactsProps): ReactElement | null {
  if (!when && !length && !status) return null;
  return (
    <dl className={styles.facts} data-case-facts="">
      {when ? (
        <div className={styles.fact}>
          <dt className={styles['fact-name']}>When</dt>
          <dd className={styles['fact-value']}>{when}</dd>
        </div>
      ) : null}
      {length ? (
        <div className={styles.fact}>
          <dt className={styles['fact-name']}>Length</dt>
          <dd className={styles['fact-value']}>{length}</dd>
        </div>
      ) : null}
      {status ? (
        <div className={styles.fact}>
          <dt className={styles['fact-name']}>Status</dt>
          <dd className={styles['fact-value']} data-tone={status.tone}>
            {status.tone ? <StatusDot tone={status.tone} className={styles.dot} /> : null}
            {status.text}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * An address that may wrap only after a dot or a slash (a <wbr> there), never inside a word, so
 * 200% text on a phone breaks 'sparkmind.vercel.app' as 'sparkmind.vercel.' / 'app'.
 */
const Address = ({ address }: { readonly address: string }): ReactElement => (
  <span data-case-address="">
    <Breakable parts={addressParts(address)} />
  </span>
);

export interface CaseLinksProps {
  /** The live site, when it is a real web address. */
  readonly live: string | null;
  /** Its address as shown: 'sparkmind.vercel.app'. */
  readonly host: string | null;
  /** The source code, when it is a real web address. */
  readonly source: string | null;
}

/** Visit <address> and Source, each opening in a new tab; nothing without either. */
export function CaseLinks({ live, host, source }: CaseLinksProps): ReactElement | null {
  if (!live && !source) return null;
  return (
    <p className={styles.links}>
      {live ? (
        <a
          href={live}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.primary}
          data-case-link="live"
        >
          <span className={styles['link-words']}>
            Visit {host ? <Address address={host} /> : 'the live site'}
            <NewTabArrow />
          </span>
          <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
        </a>
      ) : null}
      {source ? (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.secondary}
          data-case-link="source"
        >
          <Code aria-hidden="true" className={styles['link-icon']} />
          <span className={styles['link-words']}>
            Source
            <SrOnlyWords>code</SrOnlyWords>
            <NewTabArrow />
          </span>
          <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
        </a>
      ) : null}
    </p>
  );
}
