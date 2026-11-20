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
 * @file CardTitle renders a real heading when asked (`as`), with the look it has as a div: a
 * screen reader's heading list then reaches the legal pages' sections and the place cards.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { CardTitle } from '@/components/ui/card';

afterEach(cleanup);

describe('CardTitle', () => {
  it('is a div by default, not a heading', () => {
    const { container } = render(<CardTitle>Title</CardTitle>);

    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it.each([
    ['h2', 2],
    ['h3', 3],
    ['h4', 4],
  ] as const)('renders an %s heading at level %i', (as, level) => {
    render(<CardTitle as={as}>Information We Collect</CardTitle>);

    expect(
      screen.getByRole('heading', { level, name: 'Information We Collect' }),
    ).toBeInTheDocument();
  });

  it('keeps the look of the div as a heading, with the caller’s classes merged over it', () => {
    const { container: asDiv } = render(<CardTitle className="text-2xl">Title</CardTitle>);
    const divClass = asDiv.firstElementChild?.className;
    cleanup();

    render(
      <CardTitle as="h2" className="text-2xl">
        Title
      </CardTitle>,
    );
    const heading = screen.getByRole('heading', { level: 2 });

    expect(heading.className).toBe(divClass);
    // The base heading rule balances wrapped lines; the div wrapped normally, so the title does.
    expect(heading).toHaveClass('font-semibold', 'tracking-tight', 'text-wrap');
  });

  it('forwards its ref to the element it renders', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <CardTitle as="h3" ref={ref}>
        Title
      </CardTitle>,
    );

    expect(ref.current?.tagName).toBe('H3');
  });
});
