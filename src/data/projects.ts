import { ProjectItem } from '../types/projects';

export const projectsData: ProjectItem[] = [
  {
    id: 'project-portfolio-v1',
    title: 'Personal Portfolio Website V1',
    description:
      'My first personal portfolio website built with Next.js, Tailwind CSS, and TypeScript. Features a clean design and showcases my skills and early projects. Deployed on Vercel.',
    imageUrl: '/assets/images/projects/portfolio_v1.png', // Placeholder
    projectUrl: 'https://mikeodnis.vercel.app/old', // Assuming this is an old version
    repoUrl: 'https://github.com/WomB0ComB0/Portfolio-Site-V1',
    tags: ['Next.js', 'React', 'Tailwind CSS', 'TypeScript', 'Vercel'],
    category: 'Web Development',
  },
  {
    id: 'project-ai-research-tool',
    title: 'AI Research Assistant',
    description:
      'A conceptual tool designed to assist researchers by summarizing academic papers using NLP techniques and providing a searchable database of findings. Proof-of-concept stage.',
    imageUrl: '/assets/images/projects/ai_research_tool.png', // Placeholder
    repoUrl: 'https://github.com/WomB0ComB0/ai-research-assistant',
    tags: ['Python', 'NLP', 'Machine Learning', 'Flask', 'Concept'],
    category: 'Machine Learning',
  },
  {
    id: 'project-unity-game',
    title: 'Pixel Adventure Game',
    description:
      'A 2D platformer game developed in Unity with C#. Features pixel art graphics, basic character controls, and level design. Explored game development fundamentals.',
    imageUrl: '/assets/images/projects/pixel_adventure.png', // Placeholder
    projectUrl: 'https://womb0comb0.itch.io/pixel-adventure', // Example itch.io link
    repoUrl: 'https://github.com/WomB0ComB0/PixelAdventureGame',
    tags: ['Unity', 'C#', 'Game Development', 'Pixel Art', 'itch.io'],
    category: 'Game Development',
  },
  {
    id: 'project-ecommerce-site',
    title: 'E-commerce Platform Mockup',
    description:
      'A full-stack e-commerce website mockup featuring product listings, cart functionality, and user authentication. Built with the MERN stack (MongoDB, Express, React, Node.js).',
    imageUrl: '/assets/images/projects/ecommerce_mockup.png', // Placeholder
    repoUrl: 'https://github.com/WomB0ComB0/ecommerce-mern',
    tags: ['React', 'Node.js', 'MongoDB', 'Express.js', 'Full-Stack', 'Web Development'],
    category: 'Web Development',
  },
];
