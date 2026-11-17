// @vitest-environment node

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

import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';

it('renders silently on the server without a browser or a status request', () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  expect(typeof document).toBe('undefined');
  expect(renderToString(<LinkHealthBadge href="https://example.com/demo" scope="projects" />)).toBe(
    '',
  );
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockRestore();
});
