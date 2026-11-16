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
 * @file Who /sponsor thanks: one entry per person (current sponsors first, then the longest
 * standing), nobody without a login, and three states that are not a list: GitHub unavailable,
 * nobody ever, and the people to thank.
 */

import { describe, expect, it } from 'vitest';

import { displayNameOf, thanksLine, thanksOf } from '@/app/(routes)/(dev)/sponsor/_lib/thanks';
import type { GitHubSponsorsData, Sponsor } from '@/lib/api-integrations/github-sponsors';

const makeSponsor = (overrides: Partial<Sponsor> = {}): Sponsor => ({
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  url: 'https://github.com/octocat',
  tier: { name: '$5 a month', monthlyPriceInDollars: 5 },
  createdAt: '2025-01-01T00:00:00Z',
  isActive: true,
  type: 'User',
  ...overrides,
});

const data = (sponsors: Sponsor[]): GitHubSponsorsData => ({
  sponsors,
  totalCount: sponsors.length,
  totalMonthlyIncome: 0,
});

describe('thanksOf', () => {
  it('says the list is unavailable when GitHub failed or ran past the deadline', () => {
    expect(thanksOf(null)).toEqual({ state: 'unavailable' });
  });

  it('says nobody has sponsored yet when GitHub lists nobody', () => {
    expect(thanksOf(data([]))).toEqual({ state: 'none' });
  });

  it('treats a list of accounts with no login as nobody', () => {
    expect(thanksOf(data([makeSponsor({ login: '' })]))).toEqual({ state: 'none' });
  });

  it('thanks a past sponsor when nobody sponsors right now', () => {
    const view = thanksOf(
      data([makeSponsor({ login: 'former', name: 'Former', isActive: false })]),
    );
    expect(view).toMatchObject({ state: 'thanks', currentCount: 0 });
    expect(view.state === 'thanks' && view.people.map((person) => person.name)).toEqual(['Former']);
  });

  it('lists a person who sponsored twice once, as current when either sponsorship is', () => {
    const view = thanksOf(
      data([
        makeSponsor({ login: 'twice', isActive: false, createdAt: '2023-01-01T00:00:00Z' }),
        makeSponsor({ login: 'twice', isActive: true, createdAt: '2025-06-01T00:00:00Z' }),
      ]),
    );
    expect(view.state === 'thanks' && view.people).toEqual([
      expect.objectContaining({ login: 'twice', isCurrent: true }),
    ]);
    expect(view).toMatchObject({ currentCount: 1 });
  });

  it('puts current sponsors first, each group longest standing first', () => {
    const view = thanksOf(
      data([
        makeSponsor({ login: 'past-new', isActive: false, createdAt: '2025-03-01T00:00:00Z' }),
        makeSponsor({ login: 'now-new', isActive: true, createdAt: '2025-02-01T00:00:00Z' }),
        makeSponsor({ login: 'past-old', isActive: false, createdAt: '2022-01-01T00:00:00Z' }),
        makeSponsor({ login: 'now-old', isActive: true, createdAt: '2024-01-01T00:00:00Z' }),
      ]),
    );
    expect(view.state === 'thanks' && view.people.map((person) => person.login)).toEqual([
      'now-old',
      'now-new',
      'past-old',
      'past-new',
    ]);
  });

  it('keys each person by login, so one person never gets two list entries', () => {
    const view = thanksOf(data([makeSponsor({ login: 'a' }), makeSponsor({ login: 'b' })]));
    expect(view.state === 'thanks' && view.people.map((person) => person.key)).toEqual(['a', 'b']);
  });
});

describe('displayNameOf', () => {
  it('uses the name, or the login when the name is missing or blank', () => {
    expect(displayNameOf(makeSponsor({ name: ' Ada ' }))).toBe('Ada');
    expect(displayNameOf(makeSponsor({ name: null, login: 'ada' }))).toBe('ada');
    expect(displayNameOf(makeSponsor({ name: '   ', login: 'ada' }))).toBe('ada');
  });
});

describe('thanksLine', () => {
  it('says plainly when nobody sponsors right now', () => {
    expect(thanksLine(0)).toBe('To everyone who has sponsored this work. None right now.');
  });

  it('thanks current and past sponsors together otherwise', () => {
    expect(thanksLine(2)).toBe('To everyone sponsoring this work, now and before.');
  });
});
