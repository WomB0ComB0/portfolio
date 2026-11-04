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
 * @file Text colour classes on shared components that set the colour of their content.
 *
 * Spans have no base colour rule, so text inside these components takes the colour the
 * component sets explicitly.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MagicCard } from '@/components/magicui';
import { LayoutTextFlip } from '@/components/ui/layout-text-flip';

describe('LayoutTextFlip', () => {
  it('colours the name and the flipping word with the primary token', () => {
    render(<LayoutTextFlip text="Mike Odnis" words={['Mobile', 'Cloud']} />);

    expect(screen.getByText('Mike Odnis')).toHaveClass('text-primary');

    const flipBox = screen.getByText('Mobile').parentElement;
    expect(flipBox).toHaveClass('text-primary');
    expect(flipBox).not.toHaveClass('text-black');
    expect(flipBox?.className).not.toMatch(/\bdark:text-/);
  });
});

describe('MagicCard', () => {
  const cardRoot = (text: string): HTMLElement | null | undefined =>
    screen.getByText(text).parentElement?.parentElement;

  it('defaults its content to the card foreground colour', () => {
    render(
      <MagicCard>
        <p>Card body</p>
      </MagicCard>,
    );

    const root = cardRoot('Card body');
    expect(root).toHaveClass('text-card-foreground');
    expect(root).not.toHaveClass('text-primary');
  });

  it('lets a caller override the text colour', () => {
    render(
      <MagicCard className="text-foreground">
        <p>Override</p>
      </MagicCard>,
    );

    const root = cardRoot('Override');
    expect(root).toHaveClass('text-foreground');
    expect(root).not.toHaveClass('text-card-foreground');
  });
});
