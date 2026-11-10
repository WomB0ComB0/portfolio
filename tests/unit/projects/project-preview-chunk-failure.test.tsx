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

/**
 * @file The hover preview is an enhancement: when its lazily loaded code fails to arrive (a deploy
 * skew, a dropped connection, a blocked chunk), /projects keeps its rows instead of falling to
 * the route's error view. `lazy()` rethrows a rejected import during render and Suspense does
 * not catch errors (review finding, CodeRabbit on #632). Its own file because the module mock
 * below replaces the live preview for every test in the file.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { ProjectPreview } from '@/app/(routes)/(main)/(professioal)/projects/_components/project-preview';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';

vi.mock('@/app/(routes)/(main)/(professioal)/projects/_components/project-preview-live', () => {
  throw new Error('Loading chunk project-preview-live failed');
});

/** Stands in for the route's error view: shows "crashed" if anything below throws. */
class Boundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? <p>crashed</p> : this.props.children;
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps the rows when the preview’s code fails to load on a fine pointer', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === FINE_POINTER,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

  render(
    <Boundary>
      <ProjectPreview items={{}} resetOn="">
        <a href="/projects/a">Alpha</a>
      </ProjectPreview>
    </Boundary>,
  );

  expect(document.querySelector('[data-hover-preview]')).toHaveAttribute(
    'data-hover-preview',
    'on',
  );
  // Wait for the same import the preview made to settle, then let React render what it got.
  await act(async () => {
    await import(
      '@/app/(routes)/(main)/(professioal)/projects/_components/project-preview-live'
    ).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(screen.queryByText('crashed')).toBeNull();
  expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument();
});
