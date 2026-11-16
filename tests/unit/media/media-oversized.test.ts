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
 * @file An oversized CMS entry cannot burn seconds of CPU on every /media and project page: the
 * title is capped before the part patterns read it, and the description before the stream-line
 * test and the summary. YouTube's own limits (100-character titles, 5,000-character descriptions)
 * are far below the caps, so real entries read exactly as before. Synthetic data only.
 */

import { makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import { buildFeed } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { pairEntries, pairSignals } from '@/app/(routes)/(dev)/media/_lib/media-pairing';
import { markerSpan, partKey } from '@/app/(routes)/(dev)/media/_lib/media-parts';
import { projectSignals, relateProjects } from '@/app/(routes)/(dev)/media/_lib/media-projects';
import { feedRows } from '@/app/(routes)/(dev)/media/_lib/media-rows';
import { cleanSummary } from '@/app/(routes)/(dev)/media/_lib/media-summary';
import { withTopics } from '@/app/(routes)/(dev)/media/_lib/media-topic-index';

/** Far below the 2 s one oversized entry cost before the caps; generous for a loaded runner. */
const FAST_MS = 400;

/** 60,000 characters of the separator run the part patterns used to stall on. */
const HUGE_TITLE = ' - '.repeat(20_000);
/** 200,000 empty lines: the stream-line test's worst case. */
const HUGE_DESCRIPTION = '\n'.repeat(200_000);

const noImages = (): string | null => null;

/** Milliseconds `run` takes. */
function timed(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('an oversized entry', () => {
  it('reads and keys a 60,000-character title fast', () => {
    expect(HUGE_TITLE.length).toBe(60_000);
    const elapsed = timed(() => {
      markerSpan(HUGE_TITLE);
      markerSpan(`${HUGE_TITLE}Part 2`);
      partKey(HUGE_TITLE);
      partKey(`Stream (Part 1/2)${HUGE_TITLE}`);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
  });

  it('summarises a 200,000-line description fast, and finds nothing in it', () => {
    let summary = 'unset';
    const elapsed = timed(() => {
      summary = cleanSummary(HUGE_DESCRIPTION);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(summary).toBe('');
  });

  it('builds the whole feed around one fast', () => {
    const videos = [
      makeVideo({ _id: 'huge', title: HUGE_TITLE, description: HUGE_DESCRIPTION }),
      makeVideo({ _id: 'twin', title: `${HUGE_TITLE}Part 2`, description: HUGE_DESCRIPTION }),
      makeVideo({ _id: 'plain', title: 'Cloud demo', description: 'We build a demo.' }),
    ];
    // Each step on its own, so a failure names the slow one.
    let entries = buildFeed({ videos: [] }, noImages);
    const steps: Record<string, number> = {
      feed: timed(() => {
        entries = buildFeed({ videos }, noImages);
      }),
      pairs: timed(() => {
        entries = pairEntries(entries, pairSignals({ videos }), { pairs: [], notPairs: [] });
      }),
      projects: timed(() => {
        entries = relateProjects(entries, projectSignals({ videos }), [], {
          links: [],
          notLinks: [],
        });
      }),
      topics: timed(() => {
        entries = withTopics(entries, { topics: [], items: [] });
      }),
      rows: timed(() => {
        feedRows(entries, 'fold');
        feedRows(entries, 'each');
      }),
    };
    const total = Object.values(steps).reduce((sum, ms) => sum + ms, 0);

    expect(total, JSON.stringify(steps)).toBeLessThan(FAST_MS);
  });

  it('still shows the whole title it was given', () => {
    const [entry] = buildFeed(
      { videos: [makeVideo({ _id: 'long', title: HUGE_TITLE, description: '' })] },
      noImages,
    );

    expect(entry?.title).toBe(HUGE_TITLE);
  });

  it('reads a title or description of ordinary length exactly as before', () => {
    expect(partKey('Coding marathon (Part 1/2)')).toBe('coding marathon');
    expect(markerSpan('Coding marathon (Part 1/2)')).toEqual([16, 26]);
    expect(cleanSummary(`${'A sentence that says something.\n'.repeat(3)}`)).toBe(
      'A sentence that says something.',
    );
  });
});
