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
 * @file A certificate's skills as the record shows them: quiet text beside or under the title,
 * at most SKILLS_SHOWN of them and the rest counted ('+5'). Display only: the names are shortened
 * where the credential's own wording carries a qualifier ('Python (Programming Language)' reads
 * 'Python', 'Cascading Style Sheets (CSS)' reads 'CSS'), while ?skill and ?q still match the
 * names as written. Pure and server-safe; the filter island shares it.
 */

/** How many skills a certificate shows; the rest are counted as '+N'. */
export const SKILLS_SHOWN = 3;

/** The qualifier LinkedIn adds to a language's name: 'C (Programming Language)'. */
const LANGUAGE_QUALIFIER = /\s*\(programming language\)$/i;
/** A name followed by its own short form: 'Object-Oriented Programming (OOP)'. */
const WITH_SHORT_FORM = /^\S.*?\s\(([A-Z][A-Z0-9.+#]{1,5})\)$/;

/** A skill as the record shows it: its short form when the credential gives one, else as written. */
export function shortSkill(skill: string): string {
  const trimmed = skill.trim();
  const language = trimmed.replace(LANGUAGE_QUALIFIER, '');
  if (language !== trimmed && language !== '') return language;
  return WITH_SHORT_FORM.exec(trimmed)?.[1] ?? trimmed;
}

export interface SkillsLine {
  /** The skills shown, short forms, repeats (ignoring case) dropped. */
  readonly shown: readonly string[];
  /** How many more the certificate lists: '+N'. */
  readonly more: number;
}

/** The skills a certificate shows: the first `max` short forms, and how many more it lists. */
export function skillsLine(skills: readonly string[], max: number = SKILLS_SHOWN): SkillsLine {
  const seen = new Set<string>();
  const short: string[] = [];
  for (const skill of skills.map(shortSkill)) {
    const key = skill.toLowerCase();
    if (skill === '' || seen.has(key)) continue;
    seen.add(key);
    short.push(skill);
  }
  return { shown: short.slice(0, max), more: Math.max(0, short.length - max) };
}

/**
 * The skills with `lead` first, when the certificate lists it (in any case), so a ?skill filter
 * always shows the skill it kept the certificate for. The same list when it is not there.
 */
export function leadSkillFirst(skills: readonly string[], lead: string | null): readonly string[] {
  if (!lead) return skills;
  const key = lead.toLowerCase();
  const index = skills.findIndex((skill) => skill.toLowerCase() === key);
  if (index <= 0) return skills;
  return [skills[index] as string, ...skills.slice(0, index), ...skills.slice(index + 1)];
}
