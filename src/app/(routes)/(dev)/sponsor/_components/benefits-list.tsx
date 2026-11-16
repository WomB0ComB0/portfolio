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
 * @file The old benefits, compact: a two-column description list under the ways instead of four
 * centred cards above them. No icons and no tiles, so it reads as a footnote to the ways rather
 * than a pitch. Shown only with "sponsor-benefits: keep". Server-safe: no directive, no hooks.
 */

import type { ReactElement } from 'react';

import { SPONSOR_BENEFITS } from '../_lib/benefits';
import { SECTION_LABEL_CLASS } from './sponsor-classes';

const BENEFITS_HEADING_ID = 'sponsor-benefits-heading';

/** "Why sponsor": the four benefits as term and line, two columns from a small screen up. */
export function BenefitsList(): ReactElement {
  return (
    <section
      aria-labelledby={BENEFITS_HEADING_ID}
      data-sponsor-benefits=""
      className="flex flex-col gap-3"
    >
      <h2 id={BENEFITS_HEADING_ID} className={SECTION_LABEL_CLASS}>
        Why sponsor
      </h2>
      <dl className="grid gap-x-8 gap-y-4 border-t border-hairline pt-4 sm:grid-cols-2">
        {SPONSOR_BENEFITS.map((benefit) => (
          <div key={benefit.title} className="space-y-0.5">
            <dt className="tile-title text-foreground">{benefit.title}</dt>
            <dd className="tile-sub text-muted-foreground">{benefit.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
