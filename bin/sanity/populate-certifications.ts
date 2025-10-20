#!/usr/bin/env bun
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
 * @file Script to import resume certification data into Sanity CMS.
 * @description This script reads certification data from a local array and creates corresponding documents in a Sanity dataset.
 * @author Mike Odnis
 * @since 2023-08-12
 * @version 1.0.0
 * @web Sanity CMS interaction.
 * @example
 * // Usage from the shell:
 * // 1. Ensure SANITY_API_TOKEN is set:
 * //    export SANITY_API_TOKEN="your-sanity-token-here"
 * // 2. Run the script:
 * //    bun run bin/import-resume-certifications.ts
 */

import { createClient } from '@sanity/client';

/**
 * @private
 * @readonly
 * @description Sanity client instance configured to interact with the specified Sanity project and dataset.
 * It uses a token from `process.env.SANITY_API_TOKEN` for authentication.
 */
const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

/**
 * @interface CertificationData
 * @description Defines the structure for a certification document to be stored in Sanity CMS.
 * @property {string} _type - The Sanity document type, always 'certification'.
 * @property {string} title - The title of the certification.
 * @property {string} issuer - The organization or entity that issued the certification.
 * @property {string} description - A detailed description of the certification.
 * @property {string} [credentialId] - An optional ID for the credential.
 * @property {string} [credentialUrl] - An optional URL pointing to the certification credential or details.
 * @property {string} issueDate - The date when the certification was issued, in 'YYYY-MM-DD' format.
 * @property {string} [expiryDate] - An optional date when the certification expires, in 'YYYY-MM-DD' format.
 * @property {string[]} skills - An array of skills associated with this certification.
 * @property {number} order - A numerical value to define the display order of the certification.
 */
interface CertificationData {
  /**
   * @readonly
   */
  _type: 'certification';
  title: string;
  issuer: string;
  description: string;
  credentialId?: string;
  credentialUrl?: string;
  issueDate: string;
  expiryDate?: string;
  skills: string[];
  order: number;
}

/**
 * @private
 * @readonly
 * @description An array of `CertificationData` objects representing the certifications to be imported into Sanity.
 * This acts as the source data for the import process.
 */
const certifications: CertificationData[] = [
  {
    _type: 'certification',
    title: 'Lorem Ipsum Professional Certificate',
    issuer: 'Lorem Corporation',
    description:
      'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.',
    credentialUrl: 'https://www.lorem.org/certificates/ipsum-dolor-sit',
    issueDate: '2023-08-12',
    skills: ['Lorem', 'Ipsum', 'Dolor', 'Sit', 'Amet', 'Consectetur', 'Adipiscing'],
    order: 1,
  },
];

/**
 * @async
 * @function importCertifications
 * @description Imports resume certifications into a Sanity dataset by iterating over a predefined list of `CertificationData`.
 * It validates the presence of the `SANITY_API_TOKEN` environment variable and logs detailed progress and success messages.
 * This function is not idempotent; running it multiple times will create duplicate documents unless deduplication is handled externally.
 *
 * @author Mike Odnis
 * @since 2023-08-12
 * @version 1.0.0
 * @web Interacts with the Sanity Content API to create documents.
 * @throws {Error} If the `SANITY_API_TOKEN` environment variable is not set. The process will terminate with exit code 1.
 * @throws {Error} If any error occurs during the Sanity document creation process (e.g., network issues, API errors). The process will terminate with exit code 1.
 * @returns {Promise<void>} A promise that resolves when all certifications have been successfully imported and a final success message is logged.
 *   The promise will not resolve normally if the process terminates due to an error.
 *
 * @example
 * // Command-line usage:
 * // 1. Set the Sanity API token:
 * //    export SANITY_API_TOKEN="your-token-here"
 * // 2. Execute the script using Bun:
 * //    bun run bin/import-resume-certifications.ts
 *
 * @example
 * // Programmatic usage (assuming the function is exported):
 * // import { importCertifications } from './path/to/import-resume-certifications';
 * //
 * // async function runImport() {
 * //   process.env.SANITY_API_TOKEN = 'your-token-here'; // Ensure token is set
 * //   await importCertifications();
 * // }
 * //
 * // runImport().catch(console.error);
 *
 * @see {@link https://www.sanity.io/manage/personal/tokens | Sanity Personal Access Tokens} for creating API tokens.
 * @see {@link https://www.sanity.io/docs/js-client | Sanity JavaScript Client documentation}
 */
async function importCertifications(): Promise<void> {
  console.log('🎓 Starting import of resume certifications to Sanity...\n');

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ Error: SANITY_API_TOKEN environment variable is not set');
    console.log('\nTo get a token:');
    console.log('1. Go to https://www.sanity.io/manage/personal/tokens');
    console.log('2. Create a new token with "Editor" permissions');
    console.log('3. Set it: export SANITY_API_TOKEN="your-token-here"');
    process.exit(1);
  }

  try {
    for (const cert of certifications) {
      console.log(`📜 Creating: ${cert.title}...`);

      const result = await client.create(cert);

      console.log(`✅ Created with ID: ${result._id}`);
      console.log(`   Issuer: ${cert.issuer}`);
      console.log(`   Issue Date: ${cert.issueDate}`);
      if (cert.expiryDate) {
        console.log(`   Expiry Date: ${cert.expiryDate}`);
      }
      console.log(`   Skills: ${cert.skills.slice(0, 3).join(', ')}...`);
      console.log('');
    }

    console.log('✨ All certifications imported successfully!\n');
    console.log(`📊 Total certifications created: ${certifications.length}`);
    console.log('🌐 View them at: https://mikeodnis.sanity.studio/');
  } catch (error: unknown) {
    console.error('❌ Error importing certifications:', error);
    process.exit(1);
  }
}

// Run the import
importCertifications();
