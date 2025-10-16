#!/usr/bin/env bun

/**
 * @file Script to import resume project data into Sanity CMS.
 * @description This script fetches predefined project data and uploads it to a Sanity.io dataset.
 * It requires a SANITY_API_TOKEN environment variable with editor permissions.
 * @usage bun run bin/import-resume-projects.ts
 * @author Mike Odnis
 * @version 1.0.0
 * @since 2023-11-25
 * @see {@link https://www.sanity.io Sanity.io} for CMS details.
 * @see {@link https://www.sanity.io/docs/js-client/v3 Sanity Client Documentation} for API usage.
 */

import { createClient } from '@sanity/client';

/**
 * Sanity client instance configured to interact with the specified Sanity project.
 * Uses environment variable `SANITY_API_TOKEN` for authentication.
 * @web
 */
const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

/**
 * Represents the structure of a project document as stored in Sanity CMS.
 * @interface ProjectData
 * @author Mike Odnis
 * @since 2023-11-25
 */
interface ProjectData {
  /**
   * The Sanity document type for this project.
   * @readonly
   */
  _type: 'project';
  /**
   * The main title of the project.
   */
  title: string;
  /**
   * The slug for the project, used for generating unique URLs.
   */
  slug: {
    /**
     * The Sanity document type for a slug.
     * @readonly
     */
    _type: 'slug';
    /**
     * The current string value of the slug (e.g., 'lorem-ipsum-portfolio').
     */
    current: string;
  };
  /**
   * A short description or summary of the project.
   */
  description: string;
  /**
   * A detailed description of the project.
   */
  longDescription: string;
  /**
   * The category the project belongs to (e.g., 'Web Development').
   */
  category: string;
  /**
   * An array of technologies used in the project.
   */
  technologies: string[];
  /**
   * The current status of the project (e.g., 'Completed', 'In Progress').
   */
  status: string;
  /**
   * Indicates if the project should be featured on a portfolio.
   */
  featured: boolean;
  /**
   * Optional URL to the live deployment of the project.
   * @web
   */
  liveUrl?: string;
  /**
   * Optional URL to the project's GitHub repository.
   * @web
   */
  githubUrl?: string;
  /**
   * The start date of the project in 'YYYY-MM-DD' format.
   */
  startDate: string;
  /**
   * Optional end date of the project in 'YYYY-MM-DD' format.
   */
  endDate?: string;
  /**
   * A numerical value for ordering projects.
   */
  order: number;
}

/**
 * An array of predefined project data objects to be imported into Sanity.
 * Each object conforms to the {@link ProjectData} interface.
 * @type {ProjectData[]}
 * @readonly
 */
const projects: ProjectData[] = [
  {
    _type: 'project',
    title: 'Lorem Ipsum Portfolio',
    slug: {
      _type: 'slug',
      current: 'lorem-ipsum-portfolio',
    },
    description:
      'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    longDescription:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    category: 'Web Development',
    technologies: ['React', 'TypeScript', 'TailwindCSS', 'Firebase', 'Vercel'],
    status: 'Completed',
    featured: true,
    liveUrl: 'https://lorem-ipsum.dev',
    githubUrl: 'https://github.com/example/lorem-project',
    startDate: '2023-03-10',
    endDate: '2023-11-25',
    order: 1,
  },
];

/**
 * Initiates the import process for predefined resume projects into Sanity CMS.
 * It iterates through the `projects` array and creates each project as a new document in Sanity.
 *
 * This function performs the following steps:
 * 1. Checks for the presence of the `SANITY_API_TOKEN` environment variable.
 * 2. Logs the start of the import process.
 * 3. Iterates over each project in the {@link projects} array.
 * 4. Calls the Sanity client's `create` method to add the project.
 * 5. Logs the details of each successfully created project.
 * 6. Logs a success message and total count upon completion.
 * 7. Logs an error and exits if any step fails.
 *
 * @async
 * @function importProjects
 * @returns {Promise<void>} A promise that resolves when all projects are imported, or rejects on error.
 * @throws {Error} If `SANITY_API_TOKEN` is not set, leading to script termination.
 * @throws {Error} If an error occurs during Sanity API interaction (e.g., network issues, invalid token).
 * @example
 * // To run the script:
 * // export SANITY_API_TOKEN="your-token"
 * // bun run bin/import-resume-projects.ts
 * @web This function interacts directly with the Sanity CMS API to perform write operations.
 * @author Mike Odnis
 * @since 2023-11-25
 * @version 1.0.0
 * @see {@link https://www.sanity.io/docs/js-client/v3#create Sanity Client create() documentation}
 */
async function importProjects() {
  console.log('🚀 Starting import of resume projects to Sanity...\n');

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ Error: SANITY_API_TOKEN environment variable is not set');
    console.log('\nTo get a token:');
    console.log('1. Go to https://www.sanity.io/manage/personal/tokens');
    console.log('2. Create a new token with "Editor" permissions');
    console.log('3. Set it: export SANITY_API_TOKEN="your-token-here"');
    process.exit(1);
  }

  try {
    for (const project of projects) {
      console.log(`💻 Creating: ${project.title}...`);

      const result = await client.create(project);

      console.log(`✅ Created with ID: ${result._id}`);
      console.log(`   Category: ${project.category}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Featured: ${project.featured ? 'Yes' : 'No'}`);
      console.log(`   Technologies: ${project.technologies.slice(0, 3).join(', ')}...`);
      console.log('');
    }

    console.log('✨ All projects imported successfully!\n');
    console.log(`📊 Total projects created: ${projects.length}`);
    console.log('🌐 View them at: https://mikeodnis.sanity.studio/');
  } catch (error) {
    console.error('❌ Error importing projects:', error);
    process.exit(1);
  }
}

// Run the import
importProjects();
