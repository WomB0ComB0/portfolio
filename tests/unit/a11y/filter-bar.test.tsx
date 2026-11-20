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
 * @file axe on the FilterBar kit (audit 2026-11-20 minor 3: the selected state told apart by
 * shape as well as colour): a selected kind chip, the applied tokens, and the Technology picker
 * drawn open with a checked option. The whole family is composed as /projects composes it (the
 * parts tests' FullBar harness), laid out as from a 48rem page, where the picker's panel shows.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../../utils/axe';
import { FullBar } from '../console/filter-bar/harness';
import { wideLayout } from '../console/filter-bar/wide-layout';

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
});

afterEach(() => {
  cleanup();
  narrow();
});

/** The popover the Technology button targets, found by its popovertarget id. */
const pickerPanel = (): HTMLElement => {
  const trigger = screen.getByRole('button', { name: /^Technology/ });
  const panel = document.getElementById(trigger.getAttribute('popovertarget') ?? '');
  if (!panel) throw new Error('the Technology button targets no panel');
  return panel;
};

describe('the filter bar under axe', () => {
  it('finds nothing to fix with a chip selected and the Technology picker open', async () => {
    const { container } = render(<FullBar initial="?category=tools&tech=go" />);

    // What is checked: the current chip, and the open picker with a checked option.
    expect(container.querySelector('a[aria-current="true"]')).toHaveTextContent(/Tools/);
    expect(pickerPanel()).toBeVisible();
    expect(within(pickerPanel()).getByRole('checkbox', { name: /^Go/ })).toBeChecked();
    await expectNoAxeViolations(container, { label: 'the filter bar' });
  });
});
