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
 * @file The homepage's dot pattern cannot grow the page. DotPattern fills the homepage wrapper
 * (absolute inset-0) and moves down by half the scroll on every scroll. The old shell clipped
 * the column vertically; H2's does not (that broke position: sticky), so the moved pattern added
 * to the document's height and each scroll to the bottom left more blank canvas under the footer.
 * The wrapper now clips it, with `clip` rather than `hidden` so it is no scroll container. The
 * scroll height itself is measured in the browser checks.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/components/layout/layout', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { HomePage } from '@/app/_components/home';

/** Clips both axes without making a scroll container (overflow-hidden would also contain it). */
const CLIPS = /^overflow-(?:clip|hidden)$/;

const renderHome = (): HTMLElement => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>,
  );
  return container;
};

/** DotPattern's svg: the only one holding a <pattern>. */
const dotPatternIn = (container: HTMLElement): SVGSVGElement => {
  const pattern = container.querySelector('svg pattern');
  const svg = pattern?.closest('svg');
  if (!svg) throw new Error('the homepage rendered no DotPattern');
  return svg;
};

beforeEach(() => {
  // The now-playing tile asks the API; a failure is enough here.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the homepage dot pattern', () => {
  it('is absolutely positioned inside the homepage wrapper', () => {
    const container = renderHome();
    const pattern = dotPatternIn(container);

    expect(pattern.getAttribute('class') ?? '').toMatch(/(?:^|\s)absolute(?:\s|$)/);
    expect(pattern.parentElement).toBe(container.firstElementChild);
  });

  it('moves with the scroll, which is why its box must be clipped', () => {
    const pattern = dotPatternIn(renderHome());

    expect(pattern.style.transform).toMatch(/^translateY\(/);
  });

  it('is clipped by that wrapper, so its scroll offset never adds page height', () => {
    const container = renderHome();
    const wrapper = dotPatternIn(container).parentElement;

    expect(wrapper).toHaveClass('relative');
    expect([...(wrapper?.classList ?? [])].filter((name) => CLIPS.test(name))).toHaveLength(1);
  });
});
