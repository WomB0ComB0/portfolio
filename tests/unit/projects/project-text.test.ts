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
 * @file How /projects reads a project's words: the title and its summary, the kinds in a
 * free-text category (split on the spaced slash only, so AI/ML stays whole), kind slugs,
 * technology keys (C, C++ and C# distinct; React, React.js, ReactJS and React 19 one), the
 * start month in UTC, the encoded detail href and the countable noun. Synthetic values shaped
 * like the live data.
 */

import { describe, expect, it } from 'vitest';

import {
  kindSlug,
  kindsOf,
  projectCount,
  projectHref,
  splitTitle,
  startedOf,
  techKey,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-text';

describe('splitTitle', () => {
  it('splits "Name - what it is" into a title and its summary', () => {
    expect(splitTitle('Fraud Guard - AI-Powered Fraud Detection', 'Ignored.')).toEqual({
      title: 'Fraud Guard',
      summary: 'AI-Powered Fraud Detection',
    });
  });

  it('accepts an en or em dash, and keeps a hyphen inside a word', () => {
    expect(splitTitle('Grepo – Search — Fast', 'x').title).toBe('Grepo');
    expect(splitTitle('Grepo – Search — Fast', 'x').summary).toBe('Search – Fast');
    expect(splitTitle('U-Net Segmenter', 'Segments scans. Second sentence.').title).toBe(
      'U-Net Segmenter',
    );
  });

  it("falls back to the description's first sentence, then the whole description", () => {
    expect(splitTitle('Grepo', 'Searches   repos fast. Then more.').summary).toBe(
      'Searches repos fast.',
    );
    expect(splitTitle('Grepo', 'Searches repos fast').summary).toBe('Searches repos fast');
  });
});

describe('kindsOf and kindSlug', () => {
  it('splits a combined category on the spaced slash only', () => {
    expect(kindsOf('AI/ML / Full-Stack / Monorepo')).toEqual(['AI/ML', 'Full-Stack', 'Monorepo']);
    expect(kindsOf('AI/ML')).toEqual(['AI/ML']);
  });

  it('drops a trailing qualifier in brackets, blanks and repeats', () => {
    expect(kindsOf('Web Development (Elysium Freelance)')).toEqual(['Web Development']);
    expect(kindsOf('  Web /  / web  ')).toEqual(['Web']);
    expect(kindsOf('')).toEqual([]);
  });

  it('slugs a label: lower case, runs of other characters as one hyphen, trimmed', () => {
    expect(kindSlug('AI/ML')).toBe('ai-ml');
    expect(kindSlug('  Media & Entertainment ')).toBe('media-entertainment');
    expect(kindSlug('Web Development')).toBe('web-development');
    expect(kindSlug('!!')).toBe('');
  });
});

describe('techKey', () => {
  it('keeps C, C++ and C# apart', () => {
    expect(new Set([techKey('C'), techKey('C++'), techKey('C#')]).size).toBe(3);
    expect(techKey('C++')).toBe('cpp');
    expect(techKey('C#')).toBe('csharp');
    expect(techKey('.NET')).toBe('dotnet');
  });

  it('folds spellings of one technology into one key', () => {
    for (const raw of ['React', 'React.js', 'ReactJS', 'react', 'React 19']) {
      expect(techKey(raw)).toBe('react');
    }
    expect(techKey('Tailwind CSS')).toBe(techKey('TailwindCSS'));
    expect(techKey('Next.js 15')).toBe(techKey('Next.js'));
    expect(techKey('Python 3.12')).toBe('python');
    expect(techKey('Clerk (Auth)')).toBe(techKey('Clerk'));
    expect(techKey('Elysia.js')).toBe(techKey('Elysia'));
    expect(techKey('Shadcn/ui')).toBe(techKey('Shadcn UI'));
  });

  it('keeps distinct technologies distinct', () => {
    expect(techKey('React Native')).not.toBe(techKey('React'));
    expect(techKey('Go')).toBe('go');
    expect(techKey('Vue 3')).toBe('vue');
  });

  it('folds the same with extra spaces before a version or a qualifier, and after either', () => {
    expect(techKey('Python  3.12')).toBe('python');
    expect(techKey('Python 3.12  ')).toBe('python');
    expect(techKey('Clerk   (Auth) ')).toBe('clerk');
    expect(kindsOf('Web Development   (Elysium Freelance)  ')).toEqual(['Web Development']);
  });
});

describe('the patterns on text from a URL', () => {
  /** Milliseconds `run` takes. */
  const timed = (run: () => unknown): number => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };
  // A long interior run of spaces made the trailing-qualifier and -version patterns backtrack
  // quadratically: 'a' + 14,000 spaces + 'x' took about 205 ms. Linear, it is well under 1 ms.
  const hostile = `a${' '.repeat(40_000)}x`;

  it('stay linear on a long run of interior whitespace', () => {
    expect(timed(() => techKey(hostile))).toBeLessThan(100);
    expect(timed(() => kindsOf(hostile))).toBeLessThan(100);
    expect(timed(() => techKey(`a${' '.repeat(40_000)}(x`))).toBeLessThan(100);
  });
});

describe('startedOf', () => {
  it('reads a Sanity date as its month in UTC', () => {
    expect(startedOf('2024-03-01')).toEqual({ iso: '2024-03', name: 'Mar', year: '2024' });
    expect(startedOf('2024-12-31')).toEqual({ iso: '2024-12', name: 'Dec', year: '2024' });
  });

  it('is null without a date or with a malformed one', () => {
    expect(startedOf(null)).toBeNull();
    expect(startedOf(undefined)).toBeNull();
    expect(startedOf('soon')).toBeNull();
    expect(startedOf('2024-13-01')).toBeNull();
  });
});

describe('projectHref and projectCount', () => {
  it('encodes the Sanity id, as the detail page reads it', () => {
    expect(projectHref('proj-grepo')).toBe('/projects/proj-grepo');
    expect(projectHref('a b/c')).toBe('/projects/a%20b%2Fc');
  });

  it('counts projects in words', () => {
    expect(projectCount(1)).toBe('1 project');
    expect(projectCount(0)).toBe('0 projects');
    expect(projectCount(12)).toBe('12 projects');
  });
});
