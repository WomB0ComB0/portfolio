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
 * @file sanity.cli.ts, which `sanity deploy` reads for the project to deploy the hosted Studio
 * to. @sanity/cli 8 can evaluate it without the app's .env values, and `sanity deploy` then
 * stopped with 'does not contain a project identifier ("api.projectId")'. It falls back to the
 * same public project and dataset as sanity.config.ts, so the deploy never depends on env loading.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

/** The public ids sanity.config.ts falls back to (safe to expose: they ship in client code). */
const PROJECT_ID = '34jrnkds';
const DATASET = 'production';

async function loadCliConfig(): Promise<{ api?: { projectId?: string; dataset?: string } }> {
  vi.resetModules();
  return (await import('../../../sanity.cli')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sanity.cli.ts', () => {
  it('names the project and dataset without any env values, as sanity.config.ts does', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', undefined);
    vi.stubEnv('NEXT_PUBLIC_SANITY_DATASET', undefined);

    const config = await loadCliConfig();

    expect(config.api).toMatchObject({ projectId: PROJECT_ID, dataset: DATASET });
  });

  it('treats blank env values as missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_SANITY_DATASET', '');

    const config = await loadCliConfig();

    expect(config.api).toMatchObject({ projectId: PROJECT_ID, dataset: DATASET });
  });

  it('uses the env values when they are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'test-project');
    vi.stubEnv('NEXT_PUBLIC_SANITY_DATASET', 'test-dataset');

    const config = await loadCliConfig();

    expect(config.api).toMatchObject({ projectId: 'test-project', dataset: 'test-dataset' });
  });
});
