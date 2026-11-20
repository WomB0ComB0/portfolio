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
 * @file A selected filter chip, a checked Technology option and the current view are told apart
 * by shape as well as colour (audit 2026-11-20 minor 3; WCAG 1.4.1, 1.4.11): a 2px ring in the
 * brand colour inside the fill, where every other chip has a 1px hairline. The ring is drawn
 * inside the box (a border plus an inset shadow, or the pill's clipped layers), so selecting
 * one never moves the chips around it. Palette only: --brand is the periwinkle the site already
 * uses; token-contrast.test.ts checks it stands 3:1 apart from what it sits on.
 *
 * jsdom applies no Tailwind CSS, so the chips' and views' styling checks are class contracts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CHIP_CURRENT_FILL_CLASS,
  OPTION_CLASS,
  PILL_CLASS,
} from '@/components/console/filter-bar/filter-bar-classes';
import { ViewSwitch } from '@/components/console/folio/view-switch';
import { declaredValue, findRule, styleRules } from '../../styles/css-rules';

afterEach(cleanup);

const classes = (value: string): string[] => value.split(/\s+/).filter(Boolean);

describe('the selected chip', () => {
  it('is ringed 2px in the brand colour before the pill measures, with no layout change', () => {
    expect(classes(CHIP_CURRENT_FILL_CLASS)).toEqual(
      expect.arrayContaining([
        'aria-[current=true]:border-(--brand)',
        'aria-[current=true]:shadow-[inset_0_0_0_1px_var(--brand)]',
        'aria-[current=true]:bg-brand-subtle',
      ]),
    );
    expect(CHIP_CURRENT_FILL_CLASS).not.toContain('--brand-edge');
  });

  it('gets the same 2px brand ring from the sliding pill', () => {
    // The pill's outer layer is the ring's colour; its inner layer, the fill, is clipped 2px in.
    expect(PILL_CLASS).toContain(
      '[background:linear-gradient(var(--brand),var(--brand)),var(--brand-subtle)]',
    );
    expect(PILL_CLASS.match(/\+2px\)/g)).toHaveLength(4);
    expect(PILL_CLASS).not.toMatch(/\+1px\)/);
    expect(PILL_CLASS).not.toContain('--brand-edge');
  });
});

describe('the checked Technology option', () => {
  it('is ringed 2px in the brand colour, inside its box', () => {
    expect(classes(OPTION_CLASS)).toEqual(
      expect.arrayContaining([
        'has-checked:border-(--brand)',
        'has-checked:shadow-[inset_0_0_0_1px_var(--brand)]',
        'has-checked:bg-brand-subtle',
      ]),
    );
    expect(OPTION_CLASS).not.toContain('--brand-edge');
  });
});

describe('the current view', () => {
  it('is ringed 2px in the brand colour in the shared view switch', () => {
    render(
      <ViewSwitch
        label="Project views"
        current="index"
        views={[
          { value: 'stories', label: 'Stories', href: '/projects' },
          { value: 'index', label: 'Index', href: '/projects?view=index' },
        ]}
      />,
    );
    const current = screen.getByRole('link', { name: 'Index' });

    expect(current).toHaveAttribute('aria-current', 'page');
    expect(classes(current.className)).toContain(
      'aria-[current=page]:shadow-[inset_0_0_0_2px_var(--brand)]',
    );
    expect(current.className).not.toContain('--brand-edge');
  });

  it('is ringed 2px in the brand colour in Places | Photos', () => {
    const css = readFileSync(
      join(
        process.cwd(),
        'src/app/(routes)/(main)/(personal)/places/_components/places-view-nav.module.css',
      ),
      'utf8',
    );
    const current = findRule(styleRules(css), '.link[aria-current="page"]');

    expect(declaredValue(current, 'box-shadow')).toBe('inset 0 0 0 2px var(--brand)');
  });
});
