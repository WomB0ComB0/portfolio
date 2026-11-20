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

import { obfuscateLink } from '@/utils/browser/html-entities';
import packageJson from '../../package.json' with { type: 'json' };
import { profile } from './profile';

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
  name: profile.name,
  url: baseUrl,
  email: profile.email,
  tagline: profile.tagline,
  description: profile.description,
  version: packageJson.version,
  keywords: [
    /** Core & Brand */
    profile.name,
    `${profile.name} Portfolio`,
    `${profile.name} Developer`,
    profile.github.username,
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

export const emailHref = profile.emailHref;
export const { encodedText: encodedEmail } = obfuscateLink({
  scheme: 'mailto',
  address: app.email,
});
