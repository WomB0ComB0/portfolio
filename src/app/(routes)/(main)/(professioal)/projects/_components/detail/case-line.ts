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
 * @file 'Where it sits': a project's place on one time line of every dated project, pure and
 * server-safe. The line runs from the first project's year to the end of the last one's, with a
 * mark at each new year. On it sit only the marks a reader can name: this project at the day it
 * started (as Studio wrote it), and the projects that started just before and just after it, its
 * named neighbours (ties keep Studio's display order, then the title), so next and previous tell
 * the story too. A tick for every other project crowded into an unreadable comb on a phone, so
 * there are none. A project with no start date has no place on the line, and the page leaves the
 * band out.
 */

import { shortName } from '@/components/console/folio';
import { type CalendarDay, calendarDay, monthLabel } from './case-text';

/** What the line reads of a project. */
export interface LineProject {
  readonly _id: string;
  readonly title: string;
  readonly order: number;
  readonly startDate?: string | null;
}

/** A neighbour on the line: the project's short name, the month it started and its place. */
export interface Neighbour {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  /** Its place on the line, 0 to 1. */
  readonly at: number;
}

/** A year's label and where its first day falls on the line. */
export interface LineYear {
  readonly label: string;
  readonly at: number;
}

/** The line around one project. Positions are fractions of the line, 0 to 1. */
export interface ProjectLine {
  readonly earlier: Neighbour | null;
  readonly later: Neighbour | null;
  /** This project's place and the month it started. */
  readonly at: number;
  readonly month: string;
  readonly years: readonly LineYear[];
}

interface Dated {
  readonly project: LineProject;
  readonly start: CalendarDay;
}

const DAY_MS = 86_400_000;

const firstDayOf = (year: number): number => Math.round(Date.UTC(year, 0, 1) / DAY_MS);

/** The earlier start first; on one day, Studio's display order, then the title. */
const byStart = (a: Dated, b: Dated): number =>
  a.start.day - b.start.day ||
  a.project.order - b.project.order ||
  a.project.title.localeCompare(b.project.title);

/** A fraction of the line, rounded to a tenth of a percent. */
const place = (day: number, from: number, to: number): number =>
  Math.round(((day - from) / (to - from)) * 1000) / 1000;

const neighbourOf = (entry: Dated | undefined, from: number, to: number): Neighbour | null =>
  entry
    ? {
        id: entry.project._id,
        name: shortName(entry.project.title),
        month: monthLabel(entry.start),
        at: place(entry.start.day, from, to),
      }
    : null;

/** The project's line, or null when it has no start date (or is not in the list). */
export function projectLine(id: string, projects: readonly LineProject[]): ProjectLine | null {
  const dated = projects
    .map((project) => ({ project, start: calendarDay(project.startDate) }))
    .filter((entry): entry is Dated => entry.start !== null)
    .sort(byStart);
  const index = dated.findIndex((entry) => entry.project._id === id);
  const self = dated[index];
  if (!self) return null;

  const firstYear = dated[0]?.start.year ?? self.start.year;
  const lastYear = dated.at(-1)?.start.year ?? self.start.year;
  const from = firstDayOf(firstYear);
  const to = firstDayOf(lastYear + 1);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => ({
    label: String(firstYear + offset),
    at: place(firstDayOf(firstYear + offset), from, to),
  }));

  return {
    earlier: neighbourOf(dated[index - 1], from, to),
    later: neighbourOf(dated[index + 1], from, to),
    at: place(self.start.day, from, to),
    month: monthLabel(self.start),
    years,
  };
}
