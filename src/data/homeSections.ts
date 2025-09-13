import { CertificationItem, ExperienceItem } from '../types/sections';

export const certificationsData: CertificationItem[] = [
  {
    id: 'cert-google-data-analytics',
    title: 'Google Data Analytics Certificate',
    category: 'Data Analytics',
    acquisitionDate: '2023-05-01',
    imageUrl: '/assets/images/certs/google_data_analytics.png', // Example path
  },
  {
    id: 'cert-codepath-web-dev',
    title: 'CodePath Advanced Web Development',
    category: 'Web Development',
    acquisitionDate: '2022-12-15',
    expirationDate: '2024-12-15',
    imageUrl: '/assets/images/certs/codepath_web_dev.png', // Example path
  },
];

export const experienceData: ExperienceItem[] = [
  {
    id: 'exp-tech-innovators',
    companyTitle: 'Tech Innovators Inc.',
    companyImage: '/assets/images/experience/tech-innovators-logo.png',
    employmentPeriod: 'Jan 2023 - Present',
    jobTitle: 'Junior Web Developer',
    jobDescriptionShort:
      'Contributed to the development of client websites using modern web technologies like React and Node.js. Collaborated with senior developers on various projects.',
    jobDescriptionLong:
      'Detailed involvement in the full software development lifecycle, from requirement gathering to deployment. Focused on front-end development using React, Next.js, and TypeScript. Participated in daily stand-ups and sprint planning sessions. Gained experience with RESTful APIs and database integrations. Worked closely with UX/UI designers to implement responsive designs and ensure optimal user experience across different devices and browsers.',
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'MongoDB', 'Git', 'Tailwind CSS', 'Jest'],
    media: [
      { type: 'link', url: 'https://techinnovators.com/project-showcase', title: 'Project Showcase' },
      { type: 'image', url: '/assets/images/experience/tech-innovators-project.png', title: 'Main Project Screenshot' },
    ],
  },
  {
    id: 'exp-open-source-contributor',
    companyTitle: 'Open Source Community',
    companyImage: '/assets/images/experience/github-logo.png',
    employmentPeriod: 'Jun 2022 - Dec 2022',
    jobTitle: 'Volunteer Contributor',
    jobDescriptionShort:
      'Actively contributed to several open-source projects on GitHub, focusing on bug fixes and documentation improvements for JavaScript-based libraries.',
    jobDescriptionLong:
      'Made significant contributions to various open-source projects, including submitting pull requests for bug fixes, enhancing documentation, and participating in community discussions. Gained proficiency in version control with Git and collaborative development workflows. Primarily worked with JavaScript and Python projects. Helped maintain and improve popular libraries used by thousands of developers worldwide.',
    skills: ['JavaScript', 'Python', 'Git', 'GitHub', 'Markdown', 'Docker', 'CI/CD'],
    media: [
      { type: 'link', url: 'https://github.com/WomB0ComB0', title: 'My GitHub Profile' },
      { type: 'image', url: '/assets/images/experience/contribution-graph.png', title: 'GitHub Contribution Graph' },
      { type: 'link', url: 'https://github.com/WomB0ComB0?tab=repositories', title: 'Repository Portfolio' },
    ],
  },
  {
    id: 'exp-freelance-developer',
    companyTitle: 'Freelance Development',
    companyImage: '/assets/images/experience/freelance-logo.png',
    employmentPeriod: 'Mar 2022 - Present',
    jobTitle: 'Full-Stack Developer',
    jobDescriptionShort:
      'Provided web development services to small businesses and startups, creating custom solutions from concept to deployment.',
    jobDescriptionLong:
      'Delivered end-to-end web development solutions for various clients including e-commerce platforms, business websites, and web applications. Managed client relationships, project timelines, and technical requirements. Utilized modern development practices including agile methodologies, version control, and automated testing. Specialized in creating responsive, accessible, and performant web applications.',
    skills: ['React', 'Vue.js', 'Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Figma'],
    media: [
      { type: 'link', url: 'https://portfolio.example.com', title: 'Client Portfolio' },
      { type: 'image', url: '/assets/images/experience/freelance-project-1.png', title: 'E-commerce Platform' },
      { type: 'image', url: '/assets/images/experience/freelance-project-2.png', title: 'Business Dashboard' },
    ],
  },
];
