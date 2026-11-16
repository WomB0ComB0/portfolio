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
 * @file A role's words as the list prints them: Studio text without its raw links, its
 * sentences (never ended at an abbreviation or a decimal), the first sentence whole for a row,
 * the lead tile's whole sentences within a length, and the duties the description does not
 * already state.
 */

import { describe, expect, it } from 'vitest';

import {
  dutiesBeyond,
  firstSentenceOf,
  LEDE_LIMIT,
  ledeOf,
  plainText,
  sentencesOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-text';

const CURVANCE =
  "Built Curvance's company blog (https://blog.curvance.com) and Payload CMS publishing system from scratch as lead developer, and moved the lending application (https://app.curvance.com) to Next.js 16.";
const RESQ =
  'ResQ Systems builds coordination software for multi-drone operations in disaster response and public safety. Pre-revenue, with a simulation-based demo.';
const TALENTSPRINT =
  'Software Engineer Apprentice and Leadership Award recipient; led product-decoder, co-trained a U-Net brain-tumor classifier on 7,023 MRI scans, and co-wrote PG-FMS.';
const DEVELOP_FOR_GOOD =
  'Rose from Software Engineer to Engineering Manager and Product Lead over 5 back-to-back nonprofit projects. Case studies: 3D Girls (https://developforgood.notion.site/Case-Study-429302dbba7f4622ab6d4694988433db), Nevada Homeless Alliance (https://circular-teller-aff.notion.site/NHA-Nevada-Homeless-Alliance-Case-Study-d27f95730cc540059396c213db14f2e9), Barbershop Books (https://developforgood.notion.site/Barbershop-Books-Inspiring-Kids-To-Read-For-Fun-250fbe7117c0802a9bfbdc1450e33d91), and Melanin Minds Matter (https://developforgood.notion.site/Rooted-Minds_Case-Study-2fafbe7117c0808abfbfd62faff77e1a); also worked with FullCircle Experience.';
const DFG_FIRST =
  'Rose from Software Engineer to Engineering Manager and Product Lead over 5 back-to-back nonprofit projects.';

describe('plainText', () => {
  it('takes a bracketed address out with its brackets', () => {
    expect(plainText(CURVANCE)).toBe(
      "Built Curvance's company blog and Payload CMS publishing system from scratch as lead developer, and moved the lending application to Next.js 16.",
    );
  });

  it('keeps the words and the comma around a named address', () => {
    expect(
      plainText(
        'Built the company blog, blog.curvance.com (https://blog.curvance.com), from scratch',
      ),
    ).toBe('Built the company blog, blog.curvance.com, from scratch');
  });

  it('drops a bare address at the end with the dash that led to it', () => {
    expect(
      plainText(
        'Deployed a containerized web app with HTTPS (Flask, MariaDB, Docker, NGINX) — https://github.com/example/portfolio-site',
      ),
    ).toBe('Deployed a containerized web app with HTTPS (Flask, MariaDB, Docker, NGINX)');
    expect(plainText('Repository: https://example.org/repo')).toBe('Repository');
  });

  it("keeps a sentence's full stop when an address stood before it", () => {
    expect(plainText('Wrote the guide at https://example.org/guide. Then more.')).toBe(
      'Wrote the guide at. Then more.',
    );
  });

  it('collapses whitespace and leaves text without an address alone', () => {
    expect(plainText('  Teaching   fellowship\nfor interviews ')).toBe(
      'Teaching fellowship for interviews',
    );
    expect(plainText('Shipped v2.5 (the rewrite) to 7,023 users.')).toBe(
      'Shipped v2.5 (the rewrite) to 7,023 users.',
    );
    expect(plainText('')).toBe('');
  });

  it('only takes http and https addresses out', () => {
    expect(plainText('Ran ftp://files and mailto:me@example.org')).toBe(
      'Ran ftp://files and mailto:me@example.org',
    );
  });
});

describe('sentencesOf', () => {
  it('splits text into its sentences, each with its own end', () => {
    expect(sentencesOf(RESQ)).toEqual([
      'ResQ Systems builds coordination software for multi-drone operations in disaster response and public safety.',
      'Pre-revenue, with a simulation-based demo.',
    ]);
  });

  it('does not end a sentence at an abbreviation, a decimal or a dotted name', () => {
    expect(sentencesOf('Joined Think Round, Inc. as an engineer. Later left.')).toEqual([
      'Joined Think Round, Inc. as an engineer.',
      'Later left.',
    ]);
    expect(sentencesOf('Shipped v2.5 to 7,023 users. More.')).toEqual([
      'Shipped v2.5 to 7,023 users.',
      'More.',
    ]);
    expect(sentencesOf(CURVANCE)).toHaveLength(1);
  });

  it('keeps a closing quote or bracket with its sentence', () => {
    expect(sentencesOf('Posted "Chaos and Fractals." Then presented it (twice!) Done.')).toEqual([
      'Posted "Chaos and Fractals."',
      'Then presented it (twice!)',
      'Done.',
    ]);
  });

  it('keeps text with no sentence end whole, and gives none for no text', () => {
    expect(sentencesOf('Teaching fellowship for interviews')).toEqual([
      'Teaching fellowship for interviews',
    ]);
    expect(sentencesOf('   ')).toEqual([]);
  });

  it('reads the sentences without their raw links', () => {
    expect(sentencesOf(DEVELOP_FOR_GOOD)).toEqual([
      DFG_FIRST,
      'Case studies: 3D Girls, Nevada Homeless Alliance, Barbershop Books, and Melanin Minds Matter; also worked with FullCircle Experience.',
    ]);
  });
});

describe('firstSentenceOf', () => {
  it('is the whole first sentence, however long', () => {
    expect(firstSentenceOf(TALENTSPRINT)).toBe(TALENTSPRINT);
    expect(firstSentenceOf(DEVELOP_FOR_GOOD)).toBe(DFG_FIRST);
    expect(firstSentenceOf(RESQ)).toBe(
      'ResQ Systems builds coordination software for multi-drone operations in disaster response and public safety.',
    );
  });

  it('never ends in an ellipsis it added', () => {
    for (const text of [CURVANCE, RESQ, TALENTSPRINT, DEVELOP_FOR_GOOD]) {
      expect(firstSentenceOf(text)).not.toMatch(/…$|\.\.\.$/);
    }
  });

  it('is empty for no text', () => {
    expect(firstSentenceOf('')).toBe('');
  });
});

describe('ledeOf', () => {
  it('adds the sentences after the first while they fit', () => {
    expect(ledeOf(RESQ)).toBe(RESQ);
  });

  it('stops before a sentence that would pass the limit, never inside one', () => {
    const long = `${DFG_FIRST} ${'A second sentence that runs on and on. '.repeat(8).trim()}`;
    const lede = ledeOf(long);

    expect(lede.startsWith(DFG_FIRST)).toBe(true);
    expect(lede.length).toBeLessThanOrEqual(LEDE_LIMIT);
    expect(lede.endsWith('.')).toBe(true);
    expect(long.startsWith(lede)).toBe(true);
  });

  it('keeps a first sentence longer than the limit whole', () => {
    expect(ledeOf(TALENTSPRINT, 40)).toBe(TALENTSPRINT);
  });

  it('takes another limit', () => {
    expect(ledeOf(RESQ, 120)).toBe(
      'ResQ Systems builds coordination software for multi-drone operations in disaster response and public safety.',
    );
    expect(ledeOf('', 120)).toBe('');
  });
});

describe('dutiesBeyond', () => {
  it('drops a duty the description already states word for word', () => {
    const duties = [
      'Rose from Software Engineer to Engineering Manager and Product Lead over 5 back-to-back nonprofit projects',
      "Built a tiered admin system for 3D Girls' STEAM learning platform with a student team so it can serve more schools",
    ];

    expect(dutiesBeyond(DEVELOP_FOR_GOOD, duties)).toEqual([duties[1]]);
  });

  it('ignores case, punctuation and raw links when it compares', () => {
    expect(
      dutiesBeyond('Built the blog (https://blog.example.org) from scratch. Then the CMS.', [
        'built the blog, from scratch!',
        'Then the CMS (https://cms.example.org)',
        'Added 172 tests',
      ]),
    ).toEqual(['Added 172 tests']);
  });

  it('keeps a duty that says the same thing in other words, or more of it', () => {
    const duties = [
      'Published "Optimizing Image Classification Through CNNs: A Survey of Advanced Techniques" in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/10808142)',
    ];

    expect(
      dutiesBeyond(
        'Published a survey paper on CNN image classification in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/10808142).',
        duties,
      ),
    ).toEqual(duties);
  });

  it('matches whole words only', () => {
    expect(dutiesBeyond('Ran the transit platform.', ['Ran the transit', 'Ran the trans'])).toEqual(
      ['Ran the trans'],
    );
  });

  it('drops a blank duty and keeps the order of the rest', () => {
    expect(dutiesBeyond('Something else.', ['  ', 'Second', 'First'])).toEqual(['Second', 'First']);
    expect(dutiesBeyond('Something else.', [])).toEqual([]);
  });
});

describe('on a long run of spaces or full stops', () => {
  // A pattern that re-scans a run from every start takes time that grows with the run's square:
  // seconds at this length. Read once, the run takes about a millisecond.
  const RUN = 50_000;
  const BUDGET_MS = 250;
  const TEXTS = [
    ['spaces', `Built a tool${' '.repeat(RUN)}for teams`],
    ['full stops', `Built a tool${'.'.repeat(RUN)}for teams`],
    ['full stops inside an address', `See https://example.org/${'.'.repeat(RUN)}a for more`],
  ] as const;

  it.each(TEXTS)('reads a run of %s in linear time', (_name, text) => {
    const started = performance.now();
    plainText(text);
    ledeOf(text);
    dutiesBeyond(text, [text, 'Added tests']);

    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  it('still collapses the run of spaces to one', () => {
    expect(plainText(TEXTS[0][1])).toBe('Built a tool for teams');
  });
});
