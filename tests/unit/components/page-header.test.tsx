/**
 * Copyright 2025 Mike Odnis
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
 * @file The page header's icon is decorative, since the h1 beside it names the page, so it is
 * hidden from assistive tech while the title and description stay exposed.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { FiActivity } from 'react-icons/fi';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The full '@/lib' barrel includes decorator-based HTTP clients that Vitest can't parse;
// PageHeader only needs cn.
vi.mock('@/lib', async () => import('@/lib/utils'));

import { PageHeader } from '@/components/custom/page-header';

const TITLE = 'Development Statistics';
const DESCRIPTION = 'What I am up to right now.';

afterEach(() => {
  cleanup();
});

describe('PageHeader', () => {
  it('hides the decorative icon from assistive tech', () => {
    const { container } = render(
      <PageHeader title={TITLE} description={DESCRIPTION} icon={<FiActivity />} />,
    );

    const icon = container.querySelector('.page-header-icon');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });

  it('keeps the title and description exposed', () => {
    render(<PageHeader title={TITLE} description={DESCRIPTION} icon={<FiActivity />} />);

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION)).toBeVisible();
  });

  it('renders no icon wrapper without an icon', () => {
    const { container } = render(<PageHeader title={TITLE} />);

    expect(container.querySelector('.page-header-icon')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
  });
});
