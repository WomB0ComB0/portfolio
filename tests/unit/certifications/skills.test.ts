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
 * @file The record's skills line (_lib/skills.ts): the short forms it shows, at most three and a
 * count of the rest, and the ?skill filter's skill first.
 */

import { describe, expect, it } from 'vitest';

import {
  leadSkillFirst,
  SKILLS_SHOWN,
  shortSkill,
  skillsLine,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/skills';

describe('shortSkill', () => {
  it.each([
    ['Python (Programming Language)', 'Python'],
    ['C (Programming Language)', 'C'],
    ['Cascading Style Sheets (CSS)', 'CSS'],
    ['Object-Oriented Programming (OOP)', 'OOP'],
    ['Google Cloud Platform (GCP)', 'GCP'],
    ['Artificial Intelligence (AI)', 'AI'],
  ])('shows %s as %s', (skill, short) => {
    expect(shortSkill(skill)).toBe(short);
  });

  it.each([
    'React.js',
    'Node.js',
    'C++',
    'C#',
    'REST APIs',
    'Web Development',
    'Tailwind CSS',
    // Not a short form: lower case, too long, or nothing before it.
    'Teaching (online)',
    'Data Visualization (Advanced Course)',
    '(CSS)',
  ])('keeps %s as written', (skill) => {
    expect(shortSkill(skill)).toBe(skill);
  });

  it('trims what it keeps', () => {
    expect(shortSkill('  Java ')).toBe('Java');
  });
});

describe('skillsLine', () => {
  it(`shows the first ${SKILLS_SHOWN} and counts the rest`, () => {
    expect(
      skillsLine([
        'Cascading Style Sheets (CSS)',
        'Redux.js',
        'Web Development',
        'SASS',
        'React.js',
      ]),
    ).toEqual({ shown: ['CSS', 'Redux.js', 'Web Development'], more: 2 });
  });

  it('shows all of three or fewer, with nothing more', () => {
    expect(skillsLine(['C++', 'Object-Oriented Programming (OOP)'])).toEqual({
      shown: ['C++', 'OOP'],
      more: 0,
    });
    expect(skillsLine([])).toEqual({ shown: [], more: 0 });
  });

  it('drops a repeat its short form makes, ignoring case, before it counts', () => {
    expect(skillsLine(['Python (Programming Language)', 'python', 'SQL'])).toEqual({
      shown: ['Python', 'SQL'],
      more: 0,
    });
  });
});

describe('leadSkillFirst', () => {
  const skills = ['TypeORM', 'NoSQL', 'MongoDB', 'Angular'] as const;

  it('moves the filtered skill to the front, in any case, as a new list', () => {
    const led = leadSkillFirst(skills, 'angular');

    expect(led).toEqual(['Angular', 'TypeORM', 'NoSQL', 'MongoDB']);
    expect(skills).toEqual(['TypeORM', 'NoSQL', 'MongoDB', 'Angular']);
  });

  it('keeps the list as it is with no skill, an absent one, or one already first', () => {
    expect(leadSkillFirst(skills, null)).toBe(skills);
    expect(leadSkillFirst(skills, 'Rust')).toBe(skills);
    expect(leadSkillFirst(skills, 'TypeORM')).toBe(skills);
  });
});
