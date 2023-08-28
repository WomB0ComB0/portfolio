import { StaticImport } from "next/dist/shared/lib/get-img-props";

export const Projects = [
  {
    name: "Fribble",
    description: ["Used GraphQL and GrafBase (serverless GraphQL platform) to handle user storage, manage image uploads, which also had filtering functionality.","Multi Page NextJS application, pagination, with routing & server-side rendering. Next Authentication (Google Authentication w/ GCP), Utilized JWT.", "Used React (Typescript), tailwind css, GraphQL, GrafBase, Next-Authentication and Vercel."],
    tech: ["GraphQL", "GrafBase", "NextJS", "React", "TS", "Tailwind", "Auth", "Vercel", "GCP", "JWT"],
    link: "https://fribble.vercel.app/",
    image: require("../../public/assets/images/projects/fribble-logo.png"),
    imageAlt: "Fribble project image",
    github: "https://github.com/WomB0ComB0/fribble-public",
  },
  {
    name: "Creator Nebula",
    description: ["Application made to view and display creators, I did not want to make auth based ownership because that would mean I and to find a way to filter inappropriate content and implement authentication", "Implemented paginating, filtering, and sorting of data. Used Supabase for data storage and retrieval. Used ViteJS for bundling and PicoCSS for styling. Deployed on Vercel."],
    tech: ["React", "JSX", "ViteJS", "Supabase", "Vercel", "PicoCSS"],
    link: "https://web103-creator-nebula.vercel.app/",
    image: require("../../public/assets/images/projects/creator-nebula.png"),
    imageAlt: "Creator Nebula project image",
    github: "https://github.com/WomB0ComB0/web103-creator-nebula",

  },
  {
    name: "Kaleido-Snow",
    description: ["Created an online sketch pad to make perfectly symmetrical snowflakes, of any color. Once satisfied, submit. Then be cross-referenced with other snowflakes made on our site to guarantee each snowflake is unique. Could donate to a top climate charity dedicated to preserving the Earths environment. Post your snowflake on DeSo (through DeSo auth.).","React, HTML, CSS3 and JS boilerplate. Additionally, we created a Flask backend to cross-reference the hashes of created images to ensure that every snowflake made is unique."],
    tech: ["React", "HTML", "CSS3", "JS", "Flask", "DeSo"],
    link: "https://letitsnow.netlify.app/",
    image: require("../../public/assets/images/projects/kaleido-snow-logo.png"),
    imageAlt: "Kaleido-Snow project image",
    github: "https://github.com/WomB0ComB0/Kaleido-Snow",
    devpost: "https://devpost.com/software/kaleido-snow"
  },
  {
    name: "Interviewer Reviewer",
    description: ["Developed a web app that uses voice and text responses for interview questions. Our AI grades your submission and offers advice for your current skill level and overall score.","Researched and collected 140+ responses. Trained Python model with the Cohere API.", "Utilized Google Cloud’s speech-to-text API to support text submissions for accessibility."],
    tech: ["React", "Cohere API", "Google Cloud API", "Python", "HTML", "CSS3", "JS"],
    link: "",
    image: require("../../public/assets/images/projects/interviewer-reviewer.png"),
    imageAlt: "Interviewer Reviewer project image",
    github: "https://github.com/WomB0ComB0/Interviewer-Reviewer-web",
    devpost: "https://devpost.com/software/interviewerreviewer",
    figma: ""
  },
  {
    name: "Sweet Sobriety",
    description: ["Uses Web3 smart contracts to incentivize people in AA to attend their scheduled meetings.","Our landing page is created on Velo by Wix and the Admin and User pages were made in React. Data was stored on Firebase(authentication).","The smart contract was written on Solidity and the Polygon blockchain. The chatbot was created using Twilio (it needs tweaking, for unique messages)."],
    tech: ["React", "Velo by Wix", "Firebase", "Solidity", "Polygon", "Twilio"],
    link: "",
    image: require("../../public/assets/images/projects/sweet-sobriety.png"),
    imageAlt: "Sweet Sobriety project image",
    github: "https://github.com/WomB0ComB0/AA-Crypto",
    devpost: "https://devpost.com/software/sober-rewards"
  }
]
interface Skills {
  image?: string | StaticImport | any;
  borderColor?: string;
  name: string;
  certificate?: string;
}
export const Skills: Skills[] = [
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-plain.svg"),
    
    name: "Javascript",
    certificate: "https://www.sololearn.com/certificates/CT-UVPUQS7X",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg"),
    
    name: "Typescript",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"),
    
    name: "React",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jquery/jquery-original.svg"),
    
    name: "JQuery",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-plain.svg"),
    
    name: "Angular",
    certificate: "https://www.sololearn.com/certificates/CT-B1RS4MHX",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg"),
    
    name: "SASS",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-plain.svg"),
    
    name: "CSS3",
    certificate: "https://www.sololearn.com/certificates/CT-LVWMNKTE",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-plain.svg"),
    
    name: "HTML5",
    certificate: "https://www.sololearn.com/certificates/CT-J6FWI4J8",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bootstrap/bootstrap-plain.svg"),
    
    name: "Bootstrap",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-plain.svg"),
    
    name: "TailwindCss",
    certificate: "https://www.mindluster.com/student/certificate/1931556061",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/materialui/materialui-original.svg"),
    
    name: "Material UI",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg"),
    
    name: "Python",
    certificate: "https://www.sololearn.com/certificates/CT-YV5KKYLD",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redux/redux-original.svg"),
    
    name: "Redux",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/grunt/grunt-line.svg"),
    
    name: "Grunt",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/npm/npm-original-wordmark.svg"),
    
    name: "NPM",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/babel/babel-original.svg"),
    
    name: "Babel",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg"),
    
    name: "Jest",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg"),
    
    name: "GraphQL",
    certificate: "",
  },
  // {
  //   image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/denojs/denojs-original.svg"),
    
  //   name: "Dino",
  //   certificate: "",
  // },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg"),
    
    name: "Express",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg"),
    
    name: "NextJS",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg"),
    
    name: "NodeJS",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nestjs/nestjs-plain.svg"),
    
    name: "NestJS",
    certificate: "https://www.sololearn.com/certificates/CT-B1RS4MHX",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/android/android-plain.svg"),
    
    name: "Android",
    certificate: "",
  },
  //   {
  //   image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flutter/flutter-original.svg"),
    
  //   name: "Flutter",
  //   certificate: "",
  // },
  //   {
  //   image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kotlin/kotlin-original.svg"),
    
  //   name: "Kotlin",
  //   certificate: "",
  // },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg"),
    
    name: "PostgreSQL",
    certificate: "https://www.sololearn.com/certificates/CT-B71PQGBI",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg"),
    
    name: "MySQL",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-plain.svg"),
    
    name: "MongoDB",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original.svg"),
    
    name: "AWS",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/googlecloud/googlecloud-original.svg"),
    
    name: "Google Cloud",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azure/azure-original.svg"),
    
    name: "Azure",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg"),
    
    name: "Firebase",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg"),
    
    name: "GIT",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"),
    
    name: "Github",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/gitlab/gitlab-original.svg"),
    
    name: "Gitlab",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg"),
    
    name: "Docker",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bash/bash-original.svg"),
    
    name: "Bash",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg"),
    
    name: "Linux",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ubuntu/ubuntu-plain.svg"),
    
    name: "Ubuntu",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/visualstudio/visualstudio-plain.svg"),
    
    name: "Visual Studio",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg"),
    
    name: "Visual Studio Code",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/intellij/intellij-original.svg"),
    
    name: "IntelliJ",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg"),
    
    name: "Figma",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-plain.svg"),
    
    name: "Adobe XD",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg"),
    
    name: "Flask",
    certificate: "",
  },
  {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg"),
    
    name: "Java",
    certificate: "https://www.sololearn.com/certificates/CC-FKQFHXGE",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg"),
    
    name: "Vue",
    certificate: "",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg"),
    
    name: "C++",
    certificate: "https://www.sololearn.com/certificates/CC-VNXZVQ44",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg"),
    
    name: "C#",
    certificate: "https://www.sololearn.com/certificates/CC-IHNWZDTG",
  },
    {
    image: ("https://cdn.jsdelivr.net/gh/devicons/devicon/icons/dotnetcore/dotnetcore-original.svg"),
    
    name: ".NET",
    certificate: "",
  },
]
export const WorkExperience = [
  { 
    logo: require("../../public/assets/images/experience/SocialPayMe.png"),
    company: "Social PayMe",
    title: "Frontend developer",
    type: "Intern",
    location: "Remote",
    startDate: "May 2nd, 2023",
    endDate: "Present",
    description: ["Collaborated with developers and designers tod optimize and develop upon UI/UX, existing and new code bases, and microservices. While using industry standard technologies.","Developed skills in front-end and testing/debugging through practice and code reviews."," Gained valuable experience working in a fast-paced and dynamic environment, contributing to the successful delivery of multiple projects and initiatives."]
  },
  { 
    logo: require("../../public/assets/images/experience/ThinkRound.png"),
    company: "ThinkRound",
    title: "Full-stack developer team lead",
    type: "Volunteer",
    location: "Remote",
    startDate: "May 4th, 2023",
    endDate: "Present",
    description: ["Developed and implemented user-friendly and accessible web designs for Think Round's ‘Center for the Human Family’, ensuring adherence to WCAG and UX best practices.","Collaborated with the extended team to design and develop high-fidelity prototypes for ongoing projects, provided technical feedback on feasibility within the project's constraints.","Web project management to ensure optimal execution of project tasks. Team leader of the full-stack developer team. We worked on each ‘floor’, developing the entire project."]
  },
  { 
    logo: require("../../public/assets/images/experience/D1YAB.png"),
    company: "District 1 Youth Advisory Board",
    title: "Webmaster",
    type: "Freelance",
    location: "Remote",
    startDate: "March 19th, 2023",
    endDate: "Present",
    description: ["Maintained, and facilitated necessary changes. Oversaw the addition of new features and pages to improve UI/UX and functionality. Continually monitored the site's performance and analytics to identify areas for improvement and implement changes accordingly.","Made certain we were WCAG 2.1, and 508 compliant. Improved, cross-platform compatibility, responsiveness, SEO w/ GSC, and edge-case PWA aspects."]
  }
]
interface Buttons {
  name: string;
}
export const Buttons: Buttons[] = [
  { name: "About" },
  { name: "Experience" },
  { name: "Skills" },
  { name: "Projects" },
]

export const paragraphContent = `I am an ambitious and driven undergraduate Computer Science student at Farmingdale State College, specializing in web development and programming. With a solid foundation in HTML, CSS, and SCSS, I craft beautiful and user-friendly websites. My proficiency in JavaScript, including TypeScript and various frameworks like React and Redux, NextJS, jQuery, and ViteJS, enables me to create dynamic web applications. My expertise also extends to modern web tools like Tailwind CSS and handling APIs using Axios. Additionally, my knowledge of Python, CPP, CS, and Java equips me for diverse software development projects. As a quick learner, I embraces new technologies with enthusiasm and is always eager to expand his skill-set. My passion for coding and problem-solving drives me to deliver exceptional results, and as a first-generation student, I take pride in my achievements and aim to be a well-rounded addition to any team.`;

export const highlightWords = ['HTML', 'CSS', 'JavaScript', 'React', 'Python', 'CPP', 'CS', 'Java', 'Redux', 'NextJS', 'ViteJS', 'Tailwind CSS', 'Axios', 'SCSS', 'TypeScript', 'jQuery', 'APIs', 'Farmingdale State College', 'Computer Science', 'web development', 'programming', 'web tools', 'software development', 'first-generation'];
