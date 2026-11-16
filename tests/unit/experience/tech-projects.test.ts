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
 * @file The projects a role page links its technologies into (tech-projects.ts). They are an
 * extra, so they never hold or fail the page: a short deadline, the last list the process had
 * past it or on a failure, and with none at all plain technologies and a warning. (These cases
 * were pinned through the old role index, retired on 2026-11-15; the role page still loads them.)
 */

import { makeProject } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loadProjects: vi.fn(),
  peekProjects: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadProjects: h.loadProjects,
  peekProjects: h.peekProjects,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));

import {
  loadTechProjects,
  TECH_PROJECTS_DEADLINE_MS,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/tech-projects';
import { logger } from '@/utils';

const PROJECTS = [makeProject({ technologies: ['TypeScript'] })];
const CONTEXT = 'load projects for experience technology links';

beforeEach(() => {
  h.loadProjects.mockReset();
  h.peekProjects.mockReset();
  h.reportApiFailure.mockReset();
  h.peekProjects.mockReturnValue(undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loadTechProjects', () => {
  it('answers with the projects when they come in time', async () => {
    h.loadProjects.mockResolvedValue(PROJECTS);

    await expect(loadTechProjects()).resolves.toBe(PROJECTS);
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });

  it('answers null and warns once when the projects fail and none were loaded before', async () => {
    const outage = new Error('Sanity answered 503');
    h.loadProjects.mockRejectedValue(outage);

    await expect(loadTechProjects()).resolves.toBeNull();
    expect(h.reportApiFailure).toHaveBeenCalledWith(outage, { context: CONTEXT, level: 'warning' });
  });

  it('waits a short deadline at most, then answers without them', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.loadProjects.mockReturnValue(new Promise(() => undefined));
    let settled = false;
    const answer = loadTechProjects().then((projects) => {
      settled = true;
      return projects;
    });

    await vi.advanceTimersByTimeAsync(TECH_PROJECTS_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(answer).resolves.toBeNull();
  });

  it('answers with the last list it had when the read is slow, and reports nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.loadProjects.mockReturnValue(new Promise(() => undefined));
    h.peekProjects.mockReturnValue({ data: PROJECTS, loadedAt: 0 });
    const answer = loadTechProjects();

    await vi.advanceTimersByTimeAsync(TECH_PROJECTS_DEADLINE_MS);

    await expect(answer).resolves.toBe(PROJECTS);
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });
});
