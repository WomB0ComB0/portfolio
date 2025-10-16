#!/usr/bin/env bun

/**
 * Script to import resume experience data into Sanity CMS.
 * This script connects to a Sanity project using an API token and creates new 'experience' documents.
 * @file
 * @author Your Name
 * @version 1.0.0
 * @since 2023-10-27
 * @see {@link https://www.sanity.io/docs/js-client | Sanity JS Client Documentation}
 * @example
 * // Usage:
 * // 1. Ensure SANITY_API_TOKEN is set in your environment.
 * //    export SANITY_API_TOKEN="sk..."
 * // 2. Run the script:
 * //    bun run bin/import-resume-experiences.ts
 */

import { createClient } from '@sanity/client';

/**
 * Sanity client instance for interacting with the CMS.
 * Configured with project details and an API token from environment variables.
 * @type {import('@sanity/client').SanityClient}
 * @readonly
 * @since 1.0.0
 * @see {@link https://www.sanity.io/docs/js-client | Sanity JS Client Documentation}
 */
const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN, // You'll need to set this
});

/**
 * Defines the structure for an 'experience' document in Sanity CMS.
 * Represents a single work or educational experience entry in a resume.
 * @interface
 * @author Your Name
 * @version 1.0.0
 * @since 2023-10-27
 * @web This interface defines the data structure for a content type managed by a web-based CMS.
 */
interface ExperienceData {
  /**
   * The Sanity document type. Must be 'experience'.
   * @readonly
   * @public
   * @type {'experience'}
   */
  _type: 'experience';
  /**
   * The job position or role held during the experience.
   * @public
   * @type {string}
   */
  position: string;
  /**
   * The name of the company or organization where the experience took place.
   * @public
   * @type {string}
   */
  company: string;
  /**
   * Optional URL for the company or organization's website.
   * @public
   * @type {string | undefined}
   */
  companyUrl?: string;
  /**
   * Optional location of the experience (e.g., 'Remote', 'New York, NY').
   * @public
   * @type {string | undefined}
   */
  location?: string;
  /**
   * A brief, high-level description of the experience.
   * @public
   * @type {string}
   */
  description: string;
  /**
   * An array of key responsibilities or achievements during the experience.
   * @public
   * @type {string[]}
   */
  responsibilities: string[];
  /**
   * An array of technologies or tools primarily used in this experience.
   * @public
   * @type {string[]}
   */
  technologies: string[];
  /**
   * The start date of the experience in 'YYYY-MM-DD' format.
   * @public
   * @type {string}
   */
  startDate: string;
  /**
   * Optional end date of the experience in 'YYYY-MM-DD' format.
   * Required if `current` is false.
   * @public
   * @type {string | undefined}
   */
  endDate?: string;
  /**
   * Indicates if this is a current position.
   * If true, `endDate` typically should not be provided.
   * @public
   * @type {boolean}
   */
  current: boolean;
  /**
   * An order value used for sorting experiences in a display context. Lower numbers appear first.
   * @public
   * @type {number}
   */
  order: number;
}

/**
 * An array of `ExperienceData` objects representing resume entries to be imported into Sanity CMS.
 * This array serves as the static data source for the import script.
 * @type {ExperienceData[]}
 * @readonly
 * @since 1.0.0
 */
const experiences: ExperienceData[] = [
  {
    _type: 'experience',
    position: 'Lorem Ipsum Developer',
    company: 'Dolor Sit',
    location: 'Remote',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    responsibilities: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur',
    ],
    technologies: ['Lorem', 'Ipsum', 'Dolor', 'Sit', 'Amet', 'Consectetur', 'Adipiscing'],
    startDate: '2023-05-01',
    current: true,
    order: 1,
  },
];

/**
 * Imports a predefined list of resume experience data into Sanity CMS.
 * This asynchronous function connects to Sanity, validates the presence of the API token,
 * and then iterates through the `experiences` array to create new 'experience' documents in the CMS.
 *
 * @async
 * @function
 * @public
 * @author Your Name
 * @version 1.0.0
 * @since 2023-10-27
 * @returns {Promise<void>} A promise that resolves when all experiences are imported, or rejects and exits on error.
 * @throws {Error} If `SANITY_API_TOKEN` environment variable is not set, the process logs an error and exits with code 1.
 * @throws {Error} If any error occurs during the Sanity client's `create` operation, the process logs the error and exits with code 1.
 * @web This function interacts with the Sanity CMS API over HTTP to perform data creation operations.
 * @example
 * // To run the import script:
 * // Ensure the SANITY_API_TOKEN environment variable is set.
 * // export SANITY_API_TOKEN="your_sanity_api_token_here"
 * // bun run bin/import-resume-experiences.ts
 * @see {@link https://www.sanity.io/manage/personal/tokens | Sanity Token Management}
 * @see {@link https://mikeodnis.sanity.studio/ | Sanity Studio (for viewing imported data)}
 */
async function importExperiences(): Promise<void> {
  console.log('🚀 Starting import of resume experiences to Sanity...\n');

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ Error: SANITY_API_TOKEN environment variable is not set');
    console.log('\nTo get a token:');
    console.log('1. Go to https://www.sanity.io/manage/personal/tokens');
    console.log('2. Create a new token with "Editor" permissions');
    console.log('3. Set it: export SANITY_API_TOKEN="your-token-here"');
    process.exit(1);
  }

  try {
    for (const experience of experiences) {
      console.log(`📝 Creating: ${experience.position} at ${experience.company}...`);

      const result = await client.create(experience);

      console.log(`✅ Created with ID: ${result._id}`);
      console.log(`   Start Date: ${experience.startDate}`);
      console.log(
        `   ${experience.current ? '(Current Position)' : `End Date: ${experience.endDate}`}`,
      );
      console.log(`   Technologies: ${experience.technologies.slice(0, 3).join(', ')}...`);
      console.log('');
    }

    console.log('✨ All experiences imported successfully!\n');
    console.log(`📊 Total experiences created: ${experiences.length}`);
    console.log('🌐 View them at: https://mikeodnis.sanity.studio/');
  } catch (error) {
    console.error('❌ Error importing experiences:', error);
    process.exit(1);
  }
}

// Run the import
importExperiences();
