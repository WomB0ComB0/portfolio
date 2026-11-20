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
 * @file axe on the /stats header strip with its live age and Pause toggle (audit 2026-11-20
 * moderate 3, WCAG 2.2.2), as the console sets them: the figure in the age's dd, the toggle in a
 * dd of its own on the label's row, both under one LiveAgeProvider. The strip is a description
 * list, so the toggle's cell must keep it valid (definition-list, dlitem) whether it runs or is
 * paused.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LiveAge,
  LiveAgePause,
  LiveAgeProvider,
} from '@/app/(routes)/(dev)/stats/_components/console/live-age';
import { stripItems } from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { StatStrip } from '@/components/console/stat-strip';
import { expectNoAxeViolations } from '../../utils/axe';
import { consoleFixture, NOW } from '../stats/console-fixture';

afterEach(cleanup);

/** The loaded strip, as stats-console.tsx renders it inside the strip's provider. */
const renderStrip = () =>
  render(
    <LiveAgeProvider>
      <StatStrip
        aria-label="At a glance"
        items={stripItems(consoleFixture(), new Date(NOW), <LiveAge at={NOW} />, <LiveAgePause />)}
        sizing="container"
      />
    </LiveAgeProvider>,
  );

const pauseButton = (): HTMLElement => screen.getByRole('button', { name: 'Pause age counter' });

describe('the /stats live age under axe', () => {
  it('finds nothing to fix while the age runs', async () => {
    const { container } = renderStrip();

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
    await expectNoAxeViolations(container, { label: 'the running /stats age' });
  });

  it('finds nothing to fix once paused', async () => {
    const { container } = renderStrip();

    fireEvent.click(pauseButton());

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    await expectNoAxeViolations(container, { label: 'the paused /stats age' });
  });
});
