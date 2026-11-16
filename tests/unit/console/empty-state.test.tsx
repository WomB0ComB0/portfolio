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

import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/console';
import { EMPTY_CLASS } from '@/components/console/filter-bar/filter-bar-classes';

describe('EmptyState', () => {
  it('names what is missing in a heading at the level asked for, inside the filter bar empty box', () => {
    render(<EmptyState title="No talks yet" level={3} />);
    const heading = screen.getByRole('heading', { level: 3, name: 'No talks yet' });
    const box = heading.closest('[data-state="empty"]');
    expect(box).not.toBeNull();
    expect(box?.className).toBe(EMPTY_CLASS);
  });

  it('defaults to an h2 and shows its sentence', () => {
    render(<EmptyState title="Nothing playing">Spotify is quiet right now.</EmptyState>);
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing playing' })).toBeTruthy();
    expect(screen.getByText('Spotify is quiet right now.')).toBeTruthy();
  });

  it('offers one action link when given one, and none otherwise', () => {
    const { rerender } = render(<EmptyState title="No sponsors yet" />);
    expect(screen.queryByRole('link')).toBeNull();
    rerender(
      <EmptyState
        title="No sponsors yet"
        action={{ href: '/sponsor#ways', label: 'Ways to sponsor' }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Ways to sponsor' }).getAttribute('href')).toBe(
      '/sponsor#ways',
    );
  });

  it('renders in the server HTML with no client code', () => {
    const html = renderToStaticMarkup(<EmptyState title="No posts yet">Soon.</EmptyState>);
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('No posts yet');
  });
});
