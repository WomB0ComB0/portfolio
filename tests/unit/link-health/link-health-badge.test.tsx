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

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import { resetLinkHealthClientCache } from '@/components/link-health/use-link-health';

const NOW = Date.UTC(2026, 10, 16, 14, 28);
const TARGET = 'https://example.com/demo';
const INVALID_SCHEME = 'javascript:alert(1)';
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const reply = (links: Record<string, unknown>) =>
  ({ ok: true, json: async () => ({ links }) }) as Response;
const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({}));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  cleanup();
  resetLinkHealthClientCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LinkHealthBadge', () => {
  it('does not subscribe or request for an empty or ineligible URL', async () => {
    const { container } = render(
      <>
        <LinkHealthBadge href="" scope="projects" />
        <LinkHealthBadge href={null} scope="media" />
        <LinkHealthBadge href={INVALID_SCHEME} scope="experience" />
        <LinkHealthBadge href="/projects" scope="projects" />
      </>,
    );
    await flush();
    expect(container).toBeEmptyDOMElement();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('shares a scope request and labels a canonical URL without changing its original link', async () => {
    fetcher.mockResolvedValue(
      reply({ [TARGET]: { status: 'unavailable', checkedAt: new Date(NOW).toISOString() } }),
    );
    render(
      <>
        <a href={`${TARGET}#setup`} target="_blank" rel="noopener noreferrer">
          Demo
        </a>
        <LinkHealthBadge href={`${TARGET}#setup`} scope="projects" />
        <LinkHealthBadge href={`${TARGET}#other`} scope="projects" />
      </>,
    );
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const badges = document.querySelectorAll('[data-link-health="unavailable"]');
    expect(badges).toHaveLength(2);
    for (const badge of badges) {
      expect(badge).toHaveAttribute('data-link-health-url', TARGET);
      expect(badge).toHaveAttribute('data-link-health-scope', 'projects');
      expect(badge).toHaveTextContent('Unavailable');
      expect(badge).toHaveTextContent('Checked Nov 16, 14:28 UTC');
      expect(badge.querySelector('time')).toHaveAttribute('datetime', new Date(NOW).toISOString());
      expect(badge.querySelector('[tabindex], button, a')).toBeNull();
    }
    expect(screen.getByRole('link', { name: 'Demo' })).toHaveAttribute('href', `${TARGET}#setup`);
    expect(screen.getByRole('link', { name: 'Demo' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('includes optional destination context only when a warning is visible', async () => {
    fetcher.mockResolvedValue(
      reply({ [TARGET]: { status: 'unavailable', checkedAt: new Date(NOW).toISOString() } }),
    );
    render(<LinkHealthBadge href={TARGET} scope="experience" label="Release notes" />);
    await flush();
    expect(screen.getByText('Release notes:', { exact: true })).toBeInTheDocument();
  });

  it('distinguishes temporary trouble from an unavailable destination', async () => {
    fetcher.mockResolvedValue(
      reply({ [TARGET]: { status: 'temporary', checkedAt: new Date(NOW).toISOString() } }),
    );
    render(<LinkHealthBadge href={TARGET} scope="media" />);
    await flush();
    expect(screen.getByText('Temporarily unreachable', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Unavailable', { exact: true })).not.toBeInTheDocument();
    expect(document.querySelector('[data-link-health]')).toHaveAttribute(
      'data-link-health',
      'temporary',
    );
  });

  it.each(['reachable', 'unknown'])('renders no badge for %s', async (status) => {
    fetcher.mockResolvedValue(
      reply({ [TARGET]: { status, checkedAt: new Date(NOW).toISOString() } }),
    );
    const { container } = render(
      <LinkHealthBadge href={TARGET} scope="certifications" label="Hidden context" />,
    );
    await flush();
    expect(container).toBeEmptyDOMElement();
  });

  it('removes a warning at its twenty-four-hour deadline without waiting for the next poll', async () => {
    fetcher.mockResolvedValue(
      reply({
        [TARGET]: {
          status: 'unavailable',
          checkedAt: new Date(NOW - 86_400_000 + 1000).toISOString(),
        },
      }),
    );
    const { container } = render(<LinkHealthBadge href={TARGET} scope="experience" />);
    await flush();
    expect(screen.getByText('Unavailable', { exact: true })).toBeInTheDocument();
    await flush(1000);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    'invalid-date',
    new Date(NOW + 86_400_000).toISOString(),
    new Date(NOW - 86_400_000).toISOString(),
  ])('does not show an invalid, future or expired warning: %s', async (checkedAt) => {
    fetcher.mockResolvedValue(reply({ [TARGET]: { status: 'unavailable', checkedAt } }));
    const { container } = render(<LinkHealthBadge href={TARGET} scope="projects" />);
    await flush();
    expect(container).toBeEmptyDOMElement();
  });
});
