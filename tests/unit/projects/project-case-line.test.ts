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
 * @file 'Where it sits' (case-line.ts): a project's place on one line of every dated project, its
 * named neighbours by start day (ties by Studio order, then title) and their places on the line,
 * a label for each year, no tick for anything a reader cannot name, and no line at all for a
 * project without a start date.
 */

import { describe, expect, it } from 'vitest';
import {
  type LineProject,
  projectLine,
} from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-line';

const project = (id: string, title: string, startDate: string | null, order = 0): LineProject => ({
  _id: id,
  title,
  order,
  startDate,
});

const PROJECTS: readonly LineProject[] = [
  project('late', 'Later Thing - A subtitle', '2025-02-01'),
  project('first', 'First Thing', '2023-01-01'),
  project('mid', 'Middle Thing', '2024-07-01'),
  project('undated', 'Undated Thing', null),
  project('mid-tie', 'Another Middle', '2024-07-01', 5),
];

describe('projectLine', () => {
  it('names the projects that started just before and after, by their short names', () => {
    const line = projectLine('mid-tie', PROJECTS);

    expect(line?.earlier).toMatchObject({ id: 'mid', name: 'Middle Thing', month: 'Jul 2024' });
    expect(line?.later).toMatchObject({ id: 'late', name: 'Later Thing', month: 'Feb 2025' });
    expect(line?.month).toBe('Jul 2024');
  });

  it('leaves a side empty at either end of the line', () => {
    expect(projectLine('first', PROJECTS)?.earlier).toBeNull();
    expect(projectLine('late', PROJECTS)?.later).toBeNull();
  });

  it('runs the line from the first year to the end of the last, a label at each year', () => {
    const line = projectLine('mid', PROJECTS);

    expect(line?.years.map((year) => year.label)).toEqual(['2023', '2024', '2025']);
    expect(line?.years[0]?.at).toBe(0);
    expect(line?.at).toBeGreaterThan(0.45);
    expect(line?.at).toBeLessThan(0.55);
  });

  it('places the named neighbours on the line, and nothing else beside the years', () => {
    const line = projectLine('mid', PROJECTS);

    expect(line?.earlier?.at).toBe(0);
    expect(line?.later?.at).toBe(line?.at);
    expect(projectLine('late', PROJECTS)?.earlier?.at).toBe(line?.at);
    expect(projectLine('late', PROJECTS)?.at).toBeGreaterThan(line?.at ?? 1);
    expect(line).not.toHaveProperty('ticks');
  });

  it('has no line for a project without a start date, or one not in the list', () => {
    expect(projectLine('undated', PROJECTS)).toBeNull();
    expect(projectLine('missing', PROJECTS)).toBeNull();
  });

  it('places a lone project at the start of its own year', () => {
    const line = projectLine('solo', [project('solo', 'Solo', '2026-01-01')]);

    expect(line).toMatchObject({ earlier: null, later: null, at: 0 });
    expect(line?.years).toEqual([{ label: '2026', at: 0 }]);
  });
});
