const age = Math.floor(
  (new Date().getTime() - new Date('March 24, 2004').getTime()) / 1_000 / 60 / 60 / 24 / 365.25,
);

const baseUrl = 'https://mikeodnis.dev';
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
  version: (await import('../../package.json', { with: { type: 'json' } })).version,
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
  logo: new URL(encodeURIComponent(`${baseUrl}/`)),
};
