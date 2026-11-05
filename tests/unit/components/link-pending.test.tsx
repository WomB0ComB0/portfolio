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
 * @file LinkPending marks itself with data-pending while its link navigates, which is what turns
 * the spinner visible, and stays hidden from assistive technology either way.
 *
 * jsdom applies no Tailwind CSS, so visibility is checked as the attribute the
 * data-[pending]: variants key on.
 */

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinkPending } from '@/components/data/link-pending';

const { useLinkStatus } = vi.hoisted(() => ({
  useLinkStatus: vi.fn(() => ({ pending: false })),
}));

vi.mock('next/link', () => ({ useLinkStatus }));

function renderSpinner(className?: string): HTMLElement {
  const { container } = render(<LinkPending className={className} />);
  const spinner = container.querySelector('span');
  if (!(spinner instanceof HTMLElement)) throw new Error('LinkPending rendered no span');
  return spinner;
}

afterEach(() => {
  useLinkStatus.mockReset();
  useLinkStatus.mockImplementation(() => ({ pending: false }));
});

describe('LinkPending', () => {
  it('sets data-pending while the link navigates', () => {
    useLinkStatus.mockReturnValue({ pending: true });

    const spinner = renderSpinner();

    expect(spinner).toHaveAttribute('data-pending', '');
    expect(spinner).toHaveClass('opacity-0', 'data-[pending]:opacity-100');
  });

  it('has no data-pending when the link is idle', () => {
    useLinkStatus.mockReturnValue({ pending: false });

    const spinner = renderSpinner();

    expect(spinner).not.toHaveAttribute('data-pending');
  });

  it.each([true, false])('is aria-hidden (pending: %s)', (pending) => {
    useLinkStatus.mockReturnValue({ pending });

    const spinner = renderSpinner();

    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toBeEmptyDOMElement();
  });

  it('spins only for visitors who allow motion', () => {
    useLinkStatus.mockReturnValue({ pending: true });

    const spinner = renderSpinner();

    expect(spinner).toHaveClass('motion-safe:data-[pending]:animate-spin');
    expect(spinner).not.toHaveClass('animate-spin');
  });

  it('merges a caller className', () => {
    const spinner = renderSpinner('size-4 text-primary');

    expect(spinner).toHaveClass('size-4', 'text-primary');
    expect(spinner).not.toHaveClass('size-3');
  });
});
