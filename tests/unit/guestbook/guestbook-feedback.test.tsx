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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn() },
  mutateAsync: vi.fn(),
}));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/lib' barrel includes decorator-based HTTP clients that Vitest can't parse; the
// guestbook's components only need its class-name helpers.
vi.mock('@/lib', async () => ({
  ...(await import('@/lib/utils')),
  ...(await import('@/lib/ui-utils')),
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/core/auth', () => ({
  useCurrentUser: () => ({ displayName: 'Ada', email: 'ada@example.com' }),
  useSignIn: () => [vi.fn(), false],
  useSignOut: () => [vi.fn(), false],
}));
vi.mock('@/hooks', () => ({
  usePostMessage: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock('@/lib/http-clients/effect-fetcher', () => ({
  get: () => Effect.succeed({ json: { json: [] } }),
}));

import { GuestbookComponent } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook';

function renderGuestbook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuestbookComponent />
    </QueryClientProvider>,
  );
}

function send(text: string) {
  fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('guestbook feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells the visitor when the message could not be sent, and keeps their text', async () => {
    h.mutateAsync.mockRejectedValueOnce(new Error('network down'));
    renderGuestbook();

    send('Hello from the test');

    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith('Failed to send message. Please try again.'),
    );
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue('Hello from the test');
  });

  it('confirms a sent message and clears the box', async () => {
    h.mutateAsync.mockResolvedValueOnce(undefined);
    renderGuestbook();

    send('Hello from the test');

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Message sent successfully!'));
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue('');
  });

  it('tells the visitor when nothing allowed is left after sanitising, without posting', async () => {
    renderGuestbook();

    send('<b></b>');

    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith('Message contains invalid content.'),
    );
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
