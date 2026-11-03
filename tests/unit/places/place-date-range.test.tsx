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

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlaceDateRange } from '@/app/(routes)/(main)/(personal)/places/_components/place-date-range';

describe('PlaceDateRange', () => {
  it('renders nothing for an undated place', () => {
    const { container } = render(<PlaceDateRange startDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an invalid start date', () => {
    const { container } = render(<PlaceDateRange startDate="not-a-date" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single machine-readable date', () => {
    const { container } = render(<PlaceDateRange startDate="2026-05-12" className="text-xs" />);
    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(1);
    expect(times[0]).toHaveAttribute('dateTime', '2026-05-12');
    expect(times[0]).toHaveTextContent('May 12, 2026');
    expect(container.firstElementChild).toHaveClass('text-xs');
  });

  it('renders one <time> per end of a range with an accessible separator', () => {
    const { container } = render(<PlaceDateRange startDate="2026-05-19" endDate="2026-05-20" />);
    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(2);
    expect(times[0]).toHaveAttribute('dateTime', '2026-05-19');
    expect(times[0]).toHaveTextContent('May 19');
    expect(times[1]).toHaveAttribute('dateTime', '2026-05-20');
    expect(times[1]).toHaveTextContent('20, 2026');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('–');
    expect(container.querySelector('.sr-only')).toHaveTextContent('to');
  });

  it('collapses a same-day range to one <time>', () => {
    const { container } = render(<PlaceDateRange startDate="2026-05-19" endDate="2026-05-19" />);
    expect(container.querySelectorAll('time')).toHaveLength(1);
  });
});
