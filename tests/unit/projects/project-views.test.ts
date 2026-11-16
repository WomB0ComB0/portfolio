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
 * @file The three /projects views in the URL: Stories has no parameter, Index and Screens do,
 * anything else reads as Stories, and the filters are kept when the view changes, because the
 * filter schema builds every link on the view's own path.
 */

import { describe, expect, it } from 'vitest';

import { projectFilters } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-filters';
import {
  DEFAULT_PROJECT_VIEW,
  PROJECT_VIEWS,
  parseProjectView,
  projectViewPath,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-views';
import { viewLinks } from '@/components/console/folio/view-href';

const LOOKUPS = {
  kinds: { 'cli-tool': 'CLI Tool', 'web-development': 'Web Development' },
  kindOrder: ['cli-tool', 'web-development'],
  folded: [],
  techs: { rust: 'Rust', go: 'Go' },
};

describe('parseProjectView', () => {
  it('reads the three views and nothing else', () => {
    expect(parseProjectView(undefined)).toBe('stories');
    expect(parseProjectView('index')).toBe('index');
    expect(parseProjectView('screens')).toBe('screens');
    expect(parseProjectView(['index', 'screens'])).toBe('index');
    expect(parseProjectView('wall')).toBe('stories');
    expect(parseProjectView('INDEX')).toBe('stories');
  });
});

describe('projectViewPath', () => {
  it('keeps /projects for Stories and adds ?view= for the others', () => {
    expect(projectViewPath('stories')).toBe('/projects');
    expect(projectViewPath('index')).toBe('/projects?view=index');
    expect(projectViewPath('screens')).toBe('/projects?view=screens');
  });
});

describe('the filters on a view’s path', () => {
  it('keeps the view in every chip link and in Clear', () => {
    const schema = projectFilters(LOOKUPS, projectViewPath('index'));
    const state = { ...schema.empty(), category: ['cli-tool'] };

    expect(schema.path).toBe('/projects?view=index');
    expect(schema.serialize(state)).toBe('/projects?view=index&category=cli-tool');
    expect(schema.hrefFor(state, { tech: ['rust', 'go'] })).toBe(
      '/projects?view=index&category=cli-tool&tech=rust&tech=go',
    );
    expect(schema.serialize(schema.empty())).toBe('/projects?view=index');
  });

  it('writes the same links as before on Stories', () => {
    const schema = projectFilters(LOOKUPS);

    expect(schema.path).toBe('/projects');
    expect(schema.serialize({ ...schema.empty(), q: 'rust' })).toBe('/projects?q=rust');
  });

  it('switches views with the filters carried and the view swapped', () => {
    const schema = projectFilters(LOOKUPS, projectViewPath('screens'));
    const here = schema.serialize({ ...schema.empty(), category: ['cli-tool'] });
    const links = viewLinks(here, PROJECT_VIEWS, { defaultView: DEFAULT_PROJECT_VIEW });

    expect(links.map((link) => link.href)).toEqual([
      '/projects?category=cli-tool',
      '/projects?category=cli-tool&view=index',
      '/projects?category=cli-tool&view=screens',
    ]);
  });
});
