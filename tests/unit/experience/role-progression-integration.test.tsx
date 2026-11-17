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

import { cleanup, render, screen, within } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/link-health/link-health-badge', () => ({ LinkHealthBadge: () => null }));
vi.mock('@/lib/sanity/client', () => ({
  urlFor: () => {
    throw new Error('fixture has no image');
  },
}));

import { RoleStop } from '@/app/(routes)/(main)/(professioal)/experience/_components/story/role-stop';
import { RoleDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/role-detail/role-detail';
import { buildRoleStory } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-story';

const TODAY = '2026-11-16';
const parent = makeExperience({
  _id: 'example-engagement',
  company: 'Example Studio',
  position: 'Software Engineer',
  startDate: '2023-01-01',
  endDate: '2024-12-31',
  current: false,
  description: 'One engagement with the delivery team.',
  responsibilities: [],
  technologies: [],
  logo: null,
});
const grouped = {
  ...parent,
  subRoles: [
    {
      _key: 'engineer',
      position: 'Software Engineer',
      startDate: '2023-01-01',
      endDate: '2024-06-30',
      current: false,
      description: 'Built the delivery tools.',
      responsibilities: ['Documented releases.'],
      technologies: ['TypeScript'],
    },
    {
      _key: 'lead',
      position: 'Team Lead',
      startDate: '2024-04-01',
      endDate: '2024-12-31',
      current: false,
      description: 'Coordinated the delivery team.',
      responsibilities: ['Reviewed the rollout plan.'],
      technologies: [],
    },
  ],
};
function renderIndex(experience: typeof parent) {
  const story = buildRoleStory([experience], { today: TODAY });
  const stop = story.chapters.flatMap((chapter) => chapter.stops)[0];
  if (!stop) throw new Error('fixture has no parent stop');
  return render(
    <ol>
      <RoleStop stop={stop} />
    </ol>,
  );
}

afterEach(cleanup);

describe('sub-role progression in the existing experience pages', () => {
  it('adds compact dated children under one index engagement without repeating full descriptions', () => {
    const { container } = renderIndex(grouped);
    expect(container.querySelectorAll('[data-role-row]')).toHaveLength(1);
    const parentRow = container.querySelector('[data-role-row]');
    expect(parentRow?.querySelector('h3')).toHaveTextContent('Software Engineer → Team Lead');
    const progression = screen.getByRole('list', { name: 'Roles at this organization' });
    expect(progression).toHaveAttribute('data-role-progression', 'compact');
    expect(
      within(progression)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Team Lead', 'Software Engineer']);
    expect(progression.querySelectorAll('time')).toHaveLength(4);
    expect(progression.querySelector('[data-role-row], [data-role-logo]')).toBeNull();
    expect(screen.queryByText('Built the delivery tools.')).not.toBeInTheDocument();
    expect(screen.getByText(parent.description)).toBeInTheDocument();
  });

  it('puts full child details immediately after the existing parent clock and keeps one header logo', () => {
    const { container } = render(
      <RoleDetail experience={grouped} experiences={[grouped]} projects={[]} today={TODAY} />,
    );
    const clock = screen.getByRole('region', { name: 'On the clock' });
    const progression = screen.getByRole('region', { name: 'Roles at this organization' });
    expect(clock.nextElementSibling).toBe(progression);
    expect(within(progression).getByText('Built the delivery tools.')).toBeInTheDocument();
    expect(within(progression).getByText('Reviewed the rollout plan.')).toBeInTheDocument();
    expect(progression.querySelectorAll('[data-sub-role]')).toHaveLength(2);
    expect(progression.querySelectorAll('[data-sub-role-lane]')).toHaveLength(2);
    expect(container.querySelectorAll('header [data-role-detail-logo]')).toHaveLength(1);
    expect(progression.querySelector('[data-role-detail-logo], [data-role-logo], img')).toBeNull();
    expect(container.querySelector('[data-role-beside]')).toHaveTextContent('0 roles');
    expect(container.querySelector('[data-role-facts]')).toHaveTextContent('2 yrs');
  });

  it('leaves an old single-role index entry without any progression wrapper', () => {
    const { container } = renderIndex(parent);
    expect(container.querySelector('[data-role-progression]')).toBeNull();
    expect(container.querySelectorAll('[data-role-row]')).toHaveLength(1);
    expect(container.querySelector('h3')).toHaveTextContent('Software Engineer');
  });

  it('leaves an old single-role detail page and its logo in the existing layout', () => {
    const { container } = render(
      <RoleDetail experience={parent} experiences={[parent]} projects={[]} today={TODAY} />,
    );
    expect(container.querySelector('[data-role-progression]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Software Engineer' })).toBeVisible();
    expect(container.querySelectorAll('header [data-role-detail-logo]')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'On the clock' })).toBeInTheDocument();
  });
});
