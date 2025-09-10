import { ExperienceItem, CertificationItem } from '../types/sections';

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
    companyImage: '/assets/images/company/tech_innovators_logo.png', // Example path
    employmentPeriod: 'Jan 2023 - Present',
    jobTitle: 'Junior Web Developer',
    jobDescriptionShort:
      'Contributed to the development of client websites using modern web technologies like React and Node.js. Collaborated with senior developers on various projects.',
    jobDescriptionLong:
      'Detailed involvement in the full software development lifecycle, from requirement gathering to deployment. Focused on front-end development using React, Next.js, and TypeScript. Participated in daily stand-ups and sprint planning sessions. Gained experience with RESTful APIs and database integrations.',
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'MongoDB', 'Git'],
    media: [
      { type: 'link', url: 'https://techinnovators.com/project-showcase', title: 'Project Showcase' },
    ],
  },
  {
    id: 'exp-open-source-contributor',
    companyTitle: 'Open Source Community',
    employmentPeriod: 'Jun 2022 - Dec 2022',
    jobTitle: 'Volunteer Contributor',
    jobDescriptionShort:
      'Actively contributed to several open-source projects on GitHub, focusing on bug fixes and documentation improvements for JavaScript-based libraries.',
    jobDescriptionLong:
      'Made significant contributions to various open-source projects, including submitting pull requests for bug fixes, enhancing documentation, and participating in community discussions. Gained proficiency in version control with Git and collaborative development workflows. Primarily worked with JavaScript and Python projects.',
    skills: ['JavaScript', 'Python', 'Git', 'GitHub', 'Markdown'],
    media: [
      { type: 'link', url: 'https://github.com/WomB0ComB0', title: 'My GitHub Profile' },
      { type: 'image', url: '/assets/images/opensource/contribution_graph.png', title: 'Contribution Graph Example' } // Example path
    ],
  },
];
