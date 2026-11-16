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

import { describe, expect, it } from 'vitest';

import {
  linkedHrefs,
  linkedPlain,
  linkedText,
  unlinkRepeats,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/linked-text';
import {
  rawSentencesOf,
  splitLede,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-text';

describe('linkedText: a proper name before a bracketed address', () => {
  it('makes the name the link and drops the bracket', () => {
    expect(
      linkedText('Published a survey in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/1).'),
    ).toEqual([
      { kind: 'text', text: 'Published a survey in ' },
      { kind: 'link', href: 'https://ieeexplore.ieee.org/document/1', label: 'IEEE LISAT 2024' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('names each of a list of case studies, keeping the commas between them', () => {
    const parts = linkedText(
      'Case studies: 3D Girls (https://a.notion.site/x), Nevada Homeless Alliance (https://b.notion.site/y), and Melanin Minds Matter (https://a.notion.site/z); also FullCircle.',
    );
    expect(parts.filter((part) => part.kind === 'link').map((part) => part.label)).toEqual([
      '3D Girls',
      'Nevada Homeless Alliance',
      'Melanin Minds Matter',
    ]);
    expect(linkedPlain(parts)).toBe(
      'Case studies: 3D Girls, Nevada Homeless Alliance, and Melanin Minds Matter; also FullCircle.',
    );
  });

  it('never takes a run that opens its sentence for a name: it may start with a verb', () => {
    const parts = linkedText(
      'Co-wrote PG-FMS (https://gitlab.com/someone/pg-fms), a file manager.',
    );
    expect(parts).toContainEqual({
      kind: 'link',
      href: 'https://gitlab.com/someone/pg-fms',
      label: 'gitlab.com',
    });
    expect(linkedPlain(parts)).toBe('Co-wrote PG-FMS (gitlab.com), a file manager.');
  });
});

describe('linkedText: an address with no name before it', () => {
  it('keeps the bracket and names the link by its host, without www', () => {
    const parts = linkedText(
      "Built the fraternity's website (https://www.kappathetapi.org/) for it.",
    );
    expect(linkedPlain(parts)).toBe("Built the fraternity's website (kappathetapi.org) for it.");
    expect(parts[1]).toEqual({
      kind: 'link',
      href: 'https://www.kappathetapi.org/',
      label: 'kappathetapi.org',
    });
  });

  it('links the host already written before the bracket instead of printing it twice', () => {
    const parts = linkedText(
      'Built the blog, blog.curvance.com (https://blog.curvance.com), from scratch.',
    );
    expect(linkedPlain(parts)).toBe('Built the blog, blog.curvance.com, from scratch.');
    expect(parts.filter((part) => part.kind === 'link')).toEqual([
      { kind: 'link', href: 'https://blog.curvance.com', label: 'blog.curvance.com' },
    ]);
  });

  it('names a bare address at the end by its host, after its dash', () => {
    const parts = linkedText('Deployed an app (Flask, Docker) — https://github.com/someone/site');
    expect(linkedPlain(parts)).toBe('Deployed an app (Flask, Docker) — github.com');
  });

  it('turns only http and https into links, and leaves text without one as it was', () => {
    expect(linkedText('Mail me at mailto:x@example.org today.')).toEqual([
      { kind: 'text', text: 'Mail me at mailto:x@example.org today.' },
    ]);
    expect(linkedText('')).toEqual([]);
  });

  it('collapses runs of whitespace, as the rest of the page does', () => {
    expect(linkedPlain(linkedText('Two   spaces\nand a line.'))).toBe('Two spaces and a line.');
  });
});

describe('splitLede: the opening sentences with their links kept', () => {
  it('keeps whole sentences within the limit, read without their addresses', () => {
    const text =
      'First one (https://example.org/a-very-long-address-that-would-not-count). Second one. Third.';
    expect(splitLede(text, 24)).toEqual({
      lede: 'First one (https://example.org/a-very-long-address-that-would-not-count). Second one.',
      rest: 'Third.',
    });
  });

  it('keeps a first sentence over the limit whole, and the rest empty when it is all', () => {
    expect(splitLede('A rather long first sentence here.', 5)).toEqual({
      lede: 'A rather long first sentence here.',
      rest: '',
    });
  });

  it("never ends a sentence at an address's own dots", () => {
    expect(
      rawSentencesOf('On TechRxiv (https://www.techrxiv.org/doi/10.1/v1). Then more.'),
    ).toEqual(['On TechRxiv (https://www.techrxiv.org/doi/10.1/v1).', 'Then more.']);
  });
});

describe('unlinkRepeats: one link per address', () => {
  const ONE = 'https://example.org/one';

  it('keeps the first link to an address and sets the next as its name', () => {
    const { parts, seen } = unlinkRepeats(
      linkedText(`Published in IEEE LISAT 2024 (${ONE}); cited as IEEE LISAT 2024 (${ONE}) again.`),
      new Set(),
    );

    expect(linkedPlain(parts)).toBe(
      'Published in IEEE LISAT 2024; cited as IEEE LISAT 2024 again.',
    );
    expect(linkedHrefs(parts)).toEqual([ONE]);
    expect([...seen]).toEqual([ONE]);
  });

  it('sets a link already seen elsewhere as plain words, and lets a new one through', () => {
    const other = 'https://example.org/two';
    const { parts, seen } = unlinkRepeats(
      linkedText(`Alpha (${ONE}) and Beta (${other})`),
      new Set([ONE]),
    );

    expect(parts[0]).toEqual({ kind: 'text', text: 'Alpha and ' });
    expect(linkedHrefs(parts)).toEqual([other]);
    expect([...seen]).toEqual([ONE, other]);
  });

  it('drops a repeated host in its own brackets with the brackets, as it named only the link', () => {
    const { parts } = unlinkRepeats(linkedText(`The code (${ONE}) is open.`), new Set([ONE]));

    expect(parts).toEqual([{ kind: 'text', text: 'The code is open.' }]);
  });

  it('leaves its input as it was', () => {
    const input = linkedText(`Alpha (${ONE})`);
    const copy = structuredClone(input);
    unlinkRepeats(input, new Set([ONE]));

    expect(input).toEqual(copy);
  });
});
