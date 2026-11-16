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
 * @file The words /projects writes in its bylines: in progress or not, the run at month
 * precision, 'Built with' in one sentence, and counts in words. Synthetic values only.
 */

import { describe, expect, it } from 'vitest';

import {
  builtWithText,
  countWord,
  isInProgress,
  joinNames,
  PRESENT_LABEL,
  periodOf,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-words';

describe('isInProgress', () => {
  it.each([
    ['In Progress', true],
    ['in progress', true],
    ['In-Progress', true],
    ['Completed', false],
    ['Completed / Active', false],
    ['', false],
    [null, false],
  ])('%s is %s', (status, expected) => {
    expect(isInProgress(status)).toBe(expected);
  });
});

describe('periodOf', () => {
  it('writes one month once', () => {
    expect(periodOf('2025-02-03', '2025-02-20', false)).toBe('Feb 2025');
    expect(periodOf('2025-02-03', null, false)).toBe('Feb 2025');
  });

  it('writes a run inside a year with the year once', () => {
    expect(periodOf('2026-03-16', '2026-06-16', false)).toBe('Mar – Jun 2026');
  });

  it('writes a run across years in full', () => {
    expect(periodOf('2024-09-01', '2025-04-30', false)).toBe('Sep 2024 – Apr 2025');
  });

  it('runs to now while in progress with no end', () => {
    expect(periodOf('2026-04-01', null, true)).toBe('Apr 2026 – now');
    expect(periodOf('2026-04-01', '2026-07-01', true)).toBe('Apr – Jul 2026');
  });

  it('ends an open run with the one shared word a project page uses too', () => {
    expect(PRESENT_LABEL).toBe('now');
    expect(periodOf('2025-11-01', null, true)?.endsWith(` ${PRESENT_LABEL}`)).toBe(true);
  });

  it('ignores an end before its start, and has nothing without a start', () => {
    expect(periodOf('2025-05-01', '2024-01-01', false)).toBe('May 2025');
    expect(periodOf(null, '2024-01-01', true)).toBeNull();
    expect(periodOf('soon', null, false)).toBeNull();
  });
});

describe('builtWithText', () => {
  it('names up to three, then counts the rest', () => {
    expect(builtWithText(['Rust', 'Ratatui', 'TypeScript', 'Go', 'Bun'])).toBe(
      'Rust, Ratatui, TypeScript and 2 more',
    );
  });

  it('joins a short list as a sentence', () => {
    expect(builtWithText(['Python'])).toBe('Python');
    expect(builtWithText(['Python', 'Flask'])).toBe('Python and Flask');
    expect(builtWithText(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('counts and names in a sentence', () => {
  it('writes counts up to twelve in words, then figures', () => {
    expect(countWord(4)).toBe('four');
    expect(countWord(12)).toBe('twelve');
    expect(countWord(13)).toBe('13');
    expect(countWord(-1)).toBe('-1');
  });

  it('joins names with commas and a last "and"', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
