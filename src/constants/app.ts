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
 * Birth date, March 24, 2004, at midnight UTC. Fixed in UTC rather than parsed in local time so
 * a server (UTC) and a browser in any time zone roll the age over at the same instant.
 */
const BIRTH_DATE = new Date(Date.UTC(2004, 2, 24));

/**
 * Age in whole years on `date`, counted in UTC calendar days: it goes up at 00:00 UTC on March 24.
 *
 * Call it when rendering rather than storing the result at module load. A server process outlives
 * a birthday, and a value captured when it started would disagree with the browser's (a
 * hydration mismatch) until the next restart.
 *
 * @example
 *   ageOn(new Date('2026-03-23T23:59:59Z')); // 21
 *   ageOn(new Date('2026-03-24T00:00:00Z')); // 22
 */
export const ageOn = (date: Date): number => {
  const years = date.getUTCFullYear() - BIRTH_DATE.getUTCFullYear();
  const month = date.getUTCMonth();
  const birthMonth = BIRTH_DATE.getUTCMonth();
  const hasHadBirthday =
    month > birthMonth || (month === birthMonth && date.getUTCDate() >= BIRTH_DATE.getUTCDate());
  return hasHadBirthday ? years : years - 1;
};

/**
 * @readonly
 * @const
 * @private
 * @type {string}
 * @description
 * Canonical root URL for the portfolio site, used as reference throughout app constants.
 * @author Mike Odnis
 * @see https://mikeodnis.dev
 */
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

import { obfuscateLink } from '@/utils';
import packageJson from '../../package.json' with { type: 'json' };

/**
 * @interface AppMetadata
 * @readonly
 * @public
 * @description
 * Structure defining core metadata for the portfolio's main application package.
 * - name: App or author name
 * - url: Canonical portfolio url
 * - email: Primary contact email
 * - description: The home meta description and og:description, under 160 characters: the hero's
 *   positioning line and what the site holds, as the manifest says it. No age, school or place.
 * - tagline: The home hero's built-in positioning line (owner decision 7), which the link-preview
 *   card and the web app manifest repeat. Studio's tagline replaces it on the hero only.
 * - version: Current application/package version from package.json
 * - keywords: Array of branding, technology, and experience keywords for SEO/metadata
 * - logo: Root-level logo image URL
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 */
export const app: Readonly<{
  name: string;
  url: string;
  email: string;
  description: string;
  tagline: string;
  version: string;
  keywords: string[];
  logo: URL;
}> = {
  name: 'Mike Odnis',
  url: baseUrl,
  email: 'mike@mikeodnis.dev',
  tagline: 'Building web software end to end.',
  description:
    'Mike Odnis is a software engineer building web software end to end: projects, experience, certifications, places and live stats.',
  version: packageJson.version,
  keywords: [
    /** Core & Brand */
    'Mike Odnis',
    'Mike Odnis Portfolio',
    'Mike Odnis Developer',
    'WomB0ComB0',
    'The Full Stack Chronicle',

    /** Roles & Titles */
    'Software Engineer',
    'Full Stack Engineer',
    'AI Engineer',
    'Founding Engineer',
    'Product Engineer',
    'Developer Productivity Engineer',
    'Frontend Engineer',
    'Backend Engineer',
    'Software Developer',
    'Computer Science Student',
    'New Grad Software Engineer 2026',

    /** Technologies - Frontend */
    'TypeScript',
    'JavaScript',
    'React',
    'Next.js',
    'React Native',
    'Vite',
    'Angular',
    'HTML5',
    'CSS3',
    'TailwindCSS',
    'Shadcn',
    'Nativewind',

    /** Technologies - Backend  */
    'Python',
    'Node.js',
    'Go',
    'GoLang',
    'Express.js',
    'FastAPI',
    'Django',
    'Java',
    'C++',

    /** Technologies - Data & DevOps  */
    'PostgreSQL',
    'Supabase',
    'MongoDB',
    'MySQL',
    'SQL',
    'Redis',
    'AWS',
    'GCP',
    'Docker',
    'Kubernetes',
    'Vercel',
    'Netlify',
    'CI/CD',
    'SRE',
    'Serverless',

    /** Technologies - AI/ML  */
    'Artificial Intelligence',
    'Machine Learning',
    'LLM',
    'OpenAI',
    'RAG',
    'AI Agents',
    'LangChain',
    'PyTorch',
    'NLP',
    'Computer Vision',

    /**
     * Education. No place: where Mike is comes only from Location in Studio, which the page
     * metadata adds (src/lib/seo/site-metadata.ts), so clearing it leaves no city in any keyword.
     */
    'Farmingdale State College',

    /** Experience & Aspirations  */
    'Fintech',
    'EdTech',
    'AI Infrastructure',
    'Developer Tools',
    'Multimodal AI',
    'Cloud Orchestration',
    'YC Startup',
    'Early Stage Startup',

    /** Leadership & Community  */
    'GitHub Campus Expert',
    'Microsoft Learn Student Ambassador',
    'Google Developer Group',
    'GDSC',
    'CodePath Tech Fellow',
    'Hackathon Mentor',
    'Open Source Contributor',
    'First-Generation Technologist',
    'Self-Taught Developer',
  ],
  logo: new URL(`${baseUrl}/`),
};

export const { href: emailHref, encodedText: encodedEmail } = obfuscateLink({
  scheme: 'mailto',
  address: app.email,
});
