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
 * @file The privacy policy's in-text link to the cookie policy navigates client-side.
 *
 * A plain `<a href="/cookies">` reloads the whole site; next/link hands the click to the router
 * and still leaves modified clicks (new tab, new window) to the browser.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import type { NextRouter } from 'next/router';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));
// The card's hover effect is not under test.
vi.mock('@/components/magicui/magic-card', () => ({ MagicCard: passThrough }));

const renderPrivacy = () => {
  const push = vi.fn();
  const router = { push, replace: vi.fn(), prefetch: vi.fn(async () => {}) };
  render(
    <RouterContext.Provider value={router as unknown as NextRouter}>
      <Privacy />
    </RouterContext.Provider>,
  );
  return { push, link: screen.getByRole('link', { name: 'Cookie Policy' }) };
};

describe('Privacy policy links', () => {
  it('opens the cookie policy through the client router', () => {
    const { push, link } = renderPrivacy();

    expect(link).toHaveAttribute('href', '/cookies');
    const followedByBrowser = fireEvent.click(link);

    expect(followedByBrowser).toBe(false);
    expect(push).toHaveBeenCalledWith('/cookies', expect.anything());
  });

  it('leaves a Ctrl-click on the cookie policy link to the browser', () => {
    const { push, link } = renderPrivacy();
    // jsdom can't open tabs; stop its navigation once the page's own handlers have run.
    window.addEventListener('click', (event) => event.preventDefault(), { once: true });

    fireEvent.click(link, { ctrlKey: true });

    expect(push).not.toHaveBeenCalled();
  });
});
