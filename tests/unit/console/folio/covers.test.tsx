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
 * @file The type cover and the quiet stage: the word measure that sizes display words to fit
 * (checked against widths measured in Geist 600 in the lab), the cover's words (a name of at most
 * two words that names the project at a glance, checked on all 32 real titles, and the rest of
 * the short name sized to fit two lines), its box, and the stage's unlit hang.
 */

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  coverName,
  coverRatio,
  EM_PER_UNIT,
  letterUnits,
  phraseUnits,
  QuietStage,
  shortName,
  TypeCover,
  twoLineUnits,
  typeCoverWords,
  widestWordUnits,
  wordUnits,
} from '@/components/console/folio';

/** Widths in em, Geist 600 at 100px, -0.06em tracking, tabular figures (lab, 2026-11-15). */
const MEASURED_EM = {
  '2026': 2.26,
  Featured: 3.82,
  Now: 1.97,
  Enterprise: 4.33,
  synapse: 3.57,
  MedChain: 4.35,
  LinkShort: 4.15,
  FaceCrime: 4.62,
  'mikeodnis.dev': 6.1,
  WaffleHacks: 5.49,
  ResQ: 2.31,
} as const;

describe('the word measure', () => {
  it('counts narrow, wide, capital and figure letters apart', () => {
    expect(letterUnits('i')).toBe(0.5);
    expect(letterUnits('m')).toBe(1.5);
    expect(letterUnits('C')).toBe(1.2);
    expect(letterUnits('7')).toBe(1.05);
    expect(letterUnits('e')).toBe(1);
  });

  it.each(Object.entries(MEASURED_EM))(
    'never under-estimates %s, and over-estimates by under 20%%',
    (word, measured) => {
      const estimate = wordUnits(word) * EM_PER_UNIT;

      expect(estimate).toBeGreaterThanOrEqual(measured);
      expect(estimate).toBeLessThan(measured * 1.2);
    },
  );

  it('gives a short word at least two units, so it is never set enormous', () => {
    expect(wordUnits('I')).toBe(2);
  });

  it('sizes a title that wraps by its widest word', () => {
    expect(widestWordUnits('Also now')).toBe(wordUnits('Also'));
    expect(widestWordUnits('')).toBe(2);
  });
});

describe("the type cover's words", () => {
  it.each([
    ['SparkMind - AI-Driven Personalized Learning Hub', 'SparkMind'],
    ['Sample-Tool: a subtitle', 'Sample-Tool'],
    ['Sample Name (a subtitle)', 'Sample Name'],
    ['Sample | a subtitle', 'Sample'],
    ['ResQ Viz', 'ResQ Viz'],
    ['  Brain   Tumor Segmentation ', 'Brain Tumor Segmentation'],
  ])('the short name of "%s" is "%s"', (title, name) => {
    expect(shortName(title)).toBe(name);
  });

  it('names "Enterprise Data Pipeline" by its last two words, the rest on the quiet line', () => {
    // 'Data Pipeline': D 1.2 a 1 t .5 a 1 = 3.7, a space .5, Pipeline 6.7, so 10.9 units on one
    // line. The quiet line is 'Enterprise', one word: E 1.2 n 1 t .5 e 1 r .5 p 1 r .5 i .5 s 1
    // e 1 = 8.2 units.
    expect(typeCoverWords('Enterprise Data Pipeline')).toEqual({
      lead: 'Data Pipeline',
      rest: 'Enterprise',
      units: 10.9,
      restUnits: 8.2,
    });
  });

  it('has no rest line for a one-word name', () => {
    expect(typeCoverWords('MedChain')).toEqual({
      lead: 'MedChain',
      rest: '',
      units: 8.2,
      restUnits: 2,
    });
  });

  it('sizes the quiet line to fit two lines, so the clamp never cuts a word', () => {
    // 'Segmentation &' 13 units over 'Classification' 11.2: the longer line of the most even split.
    const { rest, restUnits } = typeCoverWords('Brain Tumor Segmentation & Classification');

    expect(rest).toBe('Segmentation & Classification');
    expect(restUnits).toBe(twoLineUnits(rest));
    expect(restUnits).toBeLessThan(phraseUnits(rest));
    expect(restUnits).toBeGreaterThanOrEqual(widestWordUnits(rest));
  });
});

/** The 32 project titles on the lab's /projects (its data route), 2026-11-15. */
const PROJECT_TITLES = [
  'grepo',
  'FOIA-Stream',
  'ElysiumOSS',
  'Fraud Guard - AI-Powered Transaction Monitoring',
  'SparkMind - AI-Driven Personalized Learning Hub',
  'mikeodnis.dev – Personal Portfolio',
  'Enterprise AI Recursive Web Scraper',
  'GDG on Campus FSC Website',
  'SlayerOS Documentation Site (VitePress)',
  'Purple Geckos File Management System (PG-FMS)',
  'Brain Tumor Segmentation & Classification (CNN/U-Net)',
  'Product Decoder',
  'WaffleHacks Website 2024',
  'Kappa Theta Pi National Website',
  'In2ne - AI-Driven Music Recommendation',
  'Timeframe - AR Historical Landmark Viewer',
  'Genie - AI Financial Insight Browser Extension',
  'AI-BITS - AI Search and RAG Tool',
  'Cerebrix - Adaptive Cognitive Games for Dementia Care',
  'MedChain - Patient-Controlled Healthcare Blockchain',
  'FaceCrime - AI Facial Recognition Offender Registry Search',
  'FinPlanner - AI-Driven Financial Planner and Report Generator',
  'ResQ Viz',
  'ResQ Developer Platform',
  'ui-capture',
  'Ralph',
  "RamHacks '25 Website",
  'LinkShort',
  'Enterprise Data Pipeline (Browser-Use)',
  'synapse',
  'Curvance Blog',
  'Curvance App',
] as const;

/** Each title's cover: its large line, then its quiet line. */
const COVER_WORDS: Readonly<Record<(typeof PROJECT_TITLES)[number], readonly [string, string]>> = {
  grepo: ['grepo', ''],
  'FOIA-Stream': ['FOIA-Stream', ''],
  ElysiumOSS: ['ElysiumOSS', ''],
  'Fraud Guard - AI-Powered Transaction Monitoring': ['Fraud Guard', ''],
  'SparkMind - AI-Driven Personalized Learning Hub': ['SparkMind', ''],
  'mikeodnis.dev – Personal Portfolio': ['mikeodnis.dev', ''],
  'Enterprise AI Recursive Web Scraper': ['Web Scraper', 'Enterprise AI Recursive'],
  'GDG on Campus FSC Website': ['GDG', 'on Campus FSC Website'],
  'SlayerOS Documentation Site (VitePress)': ['SlayerOS Documentation', 'Site'],
  'Purple Geckos File Management System (PG-FMS)': ['Purple Geckos', 'File Management System'],
  'Brain Tumor Segmentation & Classification (CNN/U-Net)': [
    'Brain Tumor',
    'Segmentation & Classification',
  ],
  'Product Decoder': ['Product Decoder', ''],
  'WaffleHacks Website 2024': ['WaffleHacks Website', '2024'],
  'Kappa Theta Pi National Website': ['Kappa Theta', 'Pi National Website'],
  'In2ne - AI-Driven Music Recommendation': ['In2ne', ''],
  'Timeframe - AR Historical Landmark Viewer': ['Timeframe', ''],
  'Genie - AI Financial Insight Browser Extension': ['Genie', ''],
  'AI-BITS - AI Search and RAG Tool': ['AI-BITS', ''],
  'Cerebrix - Adaptive Cognitive Games for Dementia Care': ['Cerebrix', ''],
  'MedChain - Patient-Controlled Healthcare Blockchain': ['MedChain', ''],
  'FaceCrime - AI Facial Recognition Offender Registry Search': ['FaceCrime', ''],
  'FinPlanner - AI-Driven Financial Planner and Report Generator': ['FinPlanner', ''],
  'ResQ Viz': ['ResQ Viz', ''],
  'ResQ Developer Platform': ['ResQ Developer', 'Platform'],
  'ui-capture': ['ui-capture', ''],
  Ralph: ['Ralph', ''],
  "RamHacks '25 Website": ["RamHacks '25", 'Website'],
  LinkShort: ['LinkShort', ''],
  'Enterprise Data Pipeline (Browser-Use)': ['Data Pipeline', 'Enterprise'],
  synapse: ['synapse', ''],
  'Curvance Blog': ['Curvance Blog', ''],
  'Curvance App': ['Curvance App', ''],
};

describe('the cover names of all 32 real projects', () => {
  it.each(PROJECT_TITLES)('"%s"', (title) => {
    const { lead, rest } = typeCoverWords(title, PROJECT_TITLES);

    expect([lead, rest]).toEqual(COVER_WORDS[title]);
    // At most two words, each whole: the large line is never a word cut short.
    expect(lead.split(' ').length).toBeLessThanOrEqual(2);
    for (const word of lead.split(' ')) expect(shortName(title).split(' ')).toContain(word);
  });

  it('gives no two projects the same large line, with or without the page beside them', () => {
    const alone = PROJECT_TITLES.map((title) => coverName(title).toLowerCase());
    const together = PROJECT_TITLES.map((title) => coverName(title, PROJECT_TITLES).toLowerCase());

    expect(new Set(alone).size).toBe(PROJECT_TITLES.length);
    expect(together).toEqual(alone);
  });

  it('never leads with "Brain" alone, nor gives both Enterprise projects "Enterprise"', () => {
    expect(coverName('Brain Tumor Segmentation & Classification (CNN/U-Net)')).toBe('Brain Tumor');
    expect(coverName('Enterprise AI Recursive Web Scraper')).toBe('Web Scraper');
    expect(coverName('Enterprise Data Pipeline (Browser-Use)')).toBe('Data Pipeline');
  });
});

describe('coverName among the other covers on a page', () => {
  it('swaps a name another project would also get for its next choice', () => {
    const page = ['Curvance Labs App', 'Curvance Labs Blog'];

    expect(coverName('Curvance Labs App')).toBe('Curvance Labs');
    expect(coverName('Curvance Labs App', page)).toBe('Labs App');
    expect(coverName('Curvance Labs Blog', page)).toBe('Labs Blog');
  });

  it('keeps its best name when the clash cannot be avoided, and ignores its own title', () => {
    expect(coverName('ResQ Viz', ['ResQ Viz', 'ResQ Viz '])).toBe('ResQ Viz');
    expect(coverName('Data Tool', ['Data Tool (v2)'])).toBe('Data Tool');
  });
});

describe('phraseUnits and twoLineUnits', () => {
  it.each(['\u00a0', '\u2007', '\u202f'])(
    'keeps nonbreaking spaces in a single measured run: %j',
    (space) => {
      const title = ['New', 'York', 'City', 'New', 'York', 'City'].join(space);
      expect(twoLineUnits(title)).toBe(wordUnits(title));
    },
  );
  it('measures a one-line phrase by its words and its spaces', () => {
    expect(phraseUnits('Brain Tumor')).toBe(wordUnits('Brain') + 0.5 + wordUnits('Tumor'));
    expect(phraseUnits('')).toBe(2);
  });

  it('measures two lines by the longer line of the most even split', () => {
    expect(twoLineUnits('Enterprise AI Recursive')).toBe(phraseUnits('Enterprise AI'));
    expect(twoLineUnits('Classification')).toBe(wordUnits('Classification'));
  });
});

describe('coverRatio', () => {
  it.each([
    [undefined, '16 / 10'],
    [16 / 9, String(16 / 9)],
    ['16/9', '16 / 9'],
    ['3 / 2', '3 / 2'],
    [0, '16 / 10'],
    [Number.POSITIVE_INFINITY, '16 / 10'],
    ['0/9', '16 / 10'],
  ] as const)('%s -> %s', (ratio, css) => {
    expect(coverRatio(ratio)).toBe(css);
  });
});

describe('TypeCover', () => {
  it('is decorative, the title being in the heading beside it', () => {
    const { container } = render(<TypeCover title="Enterprise Data Pipeline" />);
    const cover = container.querySelector('[data-type-cover]');

    expect(cover?.getAttribute('aria-hidden')).toBe('true');
    expect(cover?.textContent).toBe('Data PipelineEnterprise');
  });

  it('sets the name large and the rest under it, and hands CSS both widths to fit', () => {
    const { container } = render(<TypeCover title="Enterprise Data Pipeline" />);
    const cover = container.querySelector<HTMLElement>('[data-type-cover]');
    const lead = cover?.querySelector('.type-cover-lead');
    const rest = cover?.querySelector('.type-cover-rest');

    expect(cover?.className).toContain('type-cover');
    expect(lead?.textContent).toBe('Data Pipeline');
    expect(rest?.textContent).toBe('Enterprise');
    expect(cover?.style.getPropertyValue('--folio-fit')).toBe('10.9');
    expect(cover?.style.getPropertyValue('--folio-rest-fit')).toBe('8.2');
  });

  it('takes its box from a ratio, 16/10 by default', () => {
    const { container, rerender } = render(<TypeCover title="LinkShort" />);
    const cover = (): HTMLElement | null => container.querySelector('[data-type-cover]');
    expect(cover()?.style.aspectRatio).toBe('16 / 10');

    rerender(<TypeCover title="LinkShort" ratio="16/9" />);
    expect(cover()?.style.aspectRatio).toBe('16 / 9');
  });

  it('fills a positioned frame instead, with no ratio of its own', () => {
    const { container } = render(<TypeCover title="FaceCrime" fill />);
    const cover = container.querySelector<HTMLElement>('[data-type-cover]');

    expect(cover?.className).toContain('absolute');
    expect(cover?.className).toContain('inset-0');
    expect(cover?.style.aspectRatio).toBe('');
  });

  it('takes the other titles on the page, so two covers never share a large line', () => {
    const page = ['Curvance Labs App', 'Curvance Labs Blog'];
    const { container } = render(<TypeCover title="Curvance Labs Blog" others={page} />);

    expect(container.querySelector('.type-cover-lead')?.textContent).toBe('Labs Blog');
    expect(container.querySelector('.type-cover-rest')?.textContent).toBe('Curvance');
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(<TypeCover title="synapse" />);

    expect(html).toContain('data-type-cover');
    expect(html).toContain('synapse');
  });
});

describe('QuietStage', () => {
  it('lights its content with the quiet-stage utility, in a div by default', () => {
    const { container } = render(
      <QuietStage>
        <p>Head</p>
      </QuietStage>,
    );
    const stage = container.querySelector<HTMLElement>('[data-quiet-stage]');

    expect(stage?.tagName).toBe('DIV');
    expect(stage?.className).toContain('quiet-stage');
    expect(stage?.textContent).toBe('Head');
    expect(stage?.getAttribute('style')).toBeNull();
  });

  it('leaves its bottom unlit by the hang it is given, so a cover hangs onto the canvas', () => {
    const { container } = render(<QuietStage as="header" hang="34%" />);
    const stage = container.querySelector<HTMLElement>('[data-quiet-stage]');

    expect(stage?.tagName).toBe('HEADER');
    expect(stage?.style.getPropertyValue('--quiet-stage-hang')).toBe('34%');
  });

  it('ignores a hang that is not a plain length', () => {
    const { container } = render(
      // @ts-expect-error -- a value outside StageHang, as untyped code could pass.
      <QuietStage hang="calc(1px); color: red" />,
    );

    expect(container.querySelector('[data-quiet-stage]')?.getAttribute('style')).toBeNull();
  });

  it('can be a section named by its heading', () => {
    const { getByRole } = render(
      <QuietStage as="section" aria-labelledby="project-title">
        <h1 id="project-title">SparkMind</h1>
      </QuietStage>,
    );

    expect(getByRole('region', { name: 'SparkMind' })).toBeTruthy();
  });

  // Verify 2026-11-20 R3: a header or div inside a page's article has a generic role, on which
  // aria-labelledby is prohibited, so only a section takes a name.
  it('names only a section: a header or a div never carries aria-labelledby', () => {
    const { container } = render(
      <>
        {/* @ts-expect-error -- only a section takes aria-labelledby. */}
        <QuietStage as="header" aria-labelledby="project-title">
          <h1 id="project-title">SparkMind</h1>
        </QuietStage>
        {/* @ts-expect-error -- only a section takes aria-labelledby. */}
        <QuietStage aria-labelledby="project-title" />
      </>,
    );

    for (const stage of container.querySelectorAll('[data-quiet-stage]')) {
      expect(stage).not.toHaveAttribute('aria-labelledby');
    }
  });
});
