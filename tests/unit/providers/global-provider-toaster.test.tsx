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

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

// Browser-only or analytics children of the provider; they play no part in showing toasts.
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The real factory module also pulls in the Elysia API app, which Vitest can't load.
vi.mock('@/providers/server', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { createQueryClient: () => () => new QueryClient() };
});
vi.mock('@/components/animations', () => ({ PageTransition: passThrough }));
vi.mock('@/app/_components', () => ({ WebVitals: () => null }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }));
vi.mock('nuqs/adapters/next/app', () => ({ NuqsAdapter: passThrough }));
vi.mock('kbar', () => ({ KBarProvider: passThrough }));
vi.mock('@/lib/navigation/actions', () => ({ actions: [] }));

import { GlobalProvider } from '@/app/_providers/global-provider';

describe('GlobalProvider toasts', () => {
  it('mounts a toaster, so toast messages reach the screen', async () => {
    render(
      <GlobalProvider>
        <p>page</p>
      </GlobalProvider>,
    );

    act(() => {
      toast.error('Sign-in cancelled.');
    });

    expect(await screen.findByText('Sign-in cancelled.')).toBeInTheDocument();
  });

  it('renders toasts in the dark theme the site uses', async () => {
    const { container } = render(
      <GlobalProvider>
        <p>page</p>
      </GlobalProvider>,
    );

    act(() => {
      toast.success('Message sent successfully!');
    });
    await screen.findByText('Message sent successfully!');

    expect(container.ownerDocument.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      'dark',
    );
  });
});
