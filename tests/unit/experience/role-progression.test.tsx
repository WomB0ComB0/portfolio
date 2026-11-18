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
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sanity/client', () => ({ urlFor: vi.fn() }));

vi.mock('@/components/link-health/link-health-badge', () => ({ LinkHealthBadge: () => null }));

import { RoleProgression } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-progression';
import { periodOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/period';
import { lengthOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-length';
import type { RoleSubRole } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-subroles';

const engineerPeriod = periodOf({ startDate: '2023-01-01', endDate: '2024-06-30', current: false });
const leadPeriod = periodOf({ startDate: '2024-04-01', endDate: '2024-12-31', current: false });
const engineer: RoleSubRole = {
  key: 'engineer',
  position: 'Software Engineer',
  period: engineerPeriod,
  length: lengthOf(engineerPeriod, '2026-11-16'),
  description: 'Built the delivery tools.',
  duties: ['Documented releases.'],
  links: [
    {
      href: 'https://example.com/releases#notes',
      label: 'Release notes',
      host: 'example.com',
      token: false,
    },
  ],
  tech: [
    {
      name: 'TypeScript',
      link: { href: '/projects?tech=typescript', projects: 2, label: 'TypeScript' },
    },
  ],
  lane: { startPercent: 0, widthPercent: 75 },
};
const lead: RoleSubRole = {
  key: 'lead',
  position: 'Team Lead',
  period: leadPeriod,
  length: lengthOf(leadPeriod, '2026-11-16'),
  description: 'Coordinated the delivery team.',
  duties: ['Reviewed the rollout plan.'],
  links: [],
  tech: [],
  lane: { startPercent: 62.5, widthPercent: 37.5 },
};
const subRoles = [lead, engineer];

afterEach(cleanup);

describe('RoleProgression', () => {
  it.each(['compact', 'full'] as const)(
    'adds no markup to an existing single-role entry: %s',
    (variant) => {
      const { container } = render(
        <RoleProgression id="progression" subRoles={[]} variant={variant} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('shows the provided newest-first titles and date ranges in the compact nested list', () => {
    const { container } = render(
      <RoleProgression id="progression" subRoles={subRoles} variant="compact" />,
    );
    const list = screen.getByRole('list', { name: 'Roles at this organization' });
    expect(
      within(list)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Team Lead', 'Software Engineer']);
    const rows = container.querySelectorAll('[data-sub-role]');
    const [leadRow, engineerRow] = rows;
    if (!leadRow || !engineerRow) throw new Error('missing child role rows');
    expect([...leadRow.querySelectorAll('time')].map((time) => time.dateTime)).toEqual([
      leadPeriod.start?.iso,
      leadPeriod.end?.iso,
    ]);
    expect([...engineerRow.querySelectorAll('time')].map((time) => time.dateTime)).toEqual([
      engineerPeriod.start?.iso,
      engineerPeriod.end?.iso,
    ]);
    expect(screen.queryByText(engineer.description)).not.toBeInTheDocument();
    expect(screen.queryByText('Documented releases.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('[data-sub-role-lane]')).toBeNull();
    expect(container.querySelector('[data-role-row], [data-role-logo], img')).toBeNull();
  });

  it('shows full role content, named links and technology tokens without nesting anchors', () => {
    const { container } = render(<RoleProgression id="progression" subRoles={subRoles} />);
    expect(screen.getByRole('region', { name: 'Roles at this organization' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Team Lead', 'Software Engineer']);
    expect(screen.getByText(engineer.description)).toBeVisible();
    expect(screen.getByText('Documented releases.')).toBeVisible();
    const external = screen.getByRole('link', { name: /Release notes/ });
    expect(external).toHaveAttribute('href', 'https://example.com/releases#notes');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /TypeScript.*2 projects/ })).toHaveAttribute(
      'href',
      '/projects?tech=typescript',
    );
    expect(container.querySelector('a a, [data-role-logo], img')).toBeNull();
  });

  it('aligns decorative interval bars to the same parent scale while retaining text dates', () => {
    const { container } = render(<RoleProgression id="progression" subRoles={subRoles} />);
    const tracks = container.querySelectorAll<HTMLElement>('[data-sub-role-lane]');
    expect(tracks).toHaveLength(2);
    for (const track of tracks) expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(tracks[0]?.firstElementChild).toHaveStyle({ left: '62.5%', width: '37.5%' });
    expect(tracks[1]?.firstElementChild).toHaveStyle({ left: '0%', width: '75%' });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-sub-role-period] time')).toHaveLength(4);
  });

  it('keeps Present and text dates readable without inventing a bar or duration', () => {
    const current = {
      ...lead,
      period: periodOf({ startDate: '2026-01-01', endDate: null, current: true }),
      lane: null,
      length: null,
    };
    const { container } = render(<RoleProgression id="progression" subRoles={[current]} />);
    expect(screen.getByText('Present')).toBeVisible();
    expect(container.querySelector('[data-sub-role-lane]')).toBeNull();
    expect(container.querySelector('[data-sub-role-period]')).not.toHaveTextContent('·');
  });

  it('renders all detail text in the server HTML and treats descriptions as plain text', () => {
    const html = renderToString(
      <RoleProgression
        id="progression"
        subRoles={[{ ...engineer, description: 'Keep <script> as written.' }]}
      />,
    );
    expect(html).toContain('Software Engineer');
    expect(html).toContain('Documented releases.');
    expect(html).toContain('https://example.com/releases#notes');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/aria-busy="true"|opacity:\s*0(?:[;"\s])/);
  });
});
