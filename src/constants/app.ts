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
 * @public
 * @type {number}
 * @description
 * Age in years, dynamically calculated from birth date (March 24, 2004) to current time.
 * Uses average year length (365.25 days) to account for leap years.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 *   console.log(age); // e.g., 20
 */
export const age = Math.floor(
  (new Date().getTime() - new Date('March 24, 2004').getTime()) / 1_000 / 60 / 60 / 24 / 365.25,
);

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
const baseUrl = 'https://mikeodnis.dev';

import packageJson from '../../package.json';

/**
 * @interface AppMetadata
 * @readonly
 * @public
 * @description
 * Structure defining core metadata for the portfolio's main application package.
 * - name: App or author name
 * - url: Canonical portfolio url
 * - email: Primary contact email
 * - description: Short site summary with dynamic age
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
  version: string;
  keywords: string[];
  logo: URL;
}> = {
  name: 'Mike Odnis',
  url: baseUrl,
  email: 'mikeodnis3242004@gmail.com',
  description: `Explore Mike Odnis' portfolio, an innovative, ${age} year-old Computer Science student at Farmingdale State College, passionate about software development and technology.`,
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

    /** Location  */
    'Software Engineer NYC',
    'Full Stack Developer New York',
    'Founding Engineer NYC',
    'AI Engineer New York City',
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
/**
 * @readonly
 * @public
 * @type {Readonly<AppMetadata>}
 * @description
 * Main exported app metadata object. Contains branding, contact, version, logo, and SEO keyword information for Mike Odnis' web portfolio.
 * Safe to expose to web clients for rendering structured meta tags and UI branding.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 *   <img src={app.logo.toString()} alt={`${app.name} logo`} />
 */
