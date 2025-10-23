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
 * Script to import existing places data into Sanity CMS.
 * This script reads place information from a predefined dataset and creates corresponding documents in a Sanity.io project.
 * Usage: bun run bin/populate-places.ts
 * @author Mike Odnis
 * @since 2023-10-27
 */

import { createClient } from '@sanity/client';

/**
 * Sanity client instance for interacting with the Sanity.io CMS.
 * Configured with project details, API version, and an API token from environment variables.
 * @readonly
 * @web Sanity Client Documentation: {@link https://www.sanity.io/docs/js-client createClient}
 * @see {@link https://www.sanity.io/manage/personal/tokens Sanity API Tokens} to generate a token.
 * @author Mike Odnis
 * @since 2023-10-27
 */
const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

/**
 * Interface representing the structure of a 'place' document in Sanity CMS.
 * @interface PlaceData
 * @property {'place'} _type - The document type, always 'place'. This property is read-only.
 * @property {string} name - The name of the place.
 * @property {string} description - A brief description of the place or event.
 * @property {string} category - The assigned category for the place (e.g., 'Hackathon', 'Mentorship').
 * @property {number} latitude - The latitude coordinate of the place.
 * @property {number} longitude - The longitude coordinate of the place.
 * @property {number} order - An arbitrary order for display purposes, typically based on insertion order.
 * @property {boolean} featured - Indicates if the place should be highlighted or featured.
 * @author Mike Odnis
 * @since 2023-10-27
 */
interface PlaceData {
  _type: 'place';
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  order: number;
  featured: boolean;
}

/**
 * Raw data containing initial place entries before processing into `PlaceData` format.
 * Each inner array represents a place with `[name, description, latitude, longitude]`.
 * @readonly
 * @type {Array<[string, string, number, number]>}
 * @author Mike Odnis
 * @since 2023-10-27
 */
const rawPlacesData: Array<[string, string, number, number]> = [
  ['Treehacks', 'Mentor', 37.431314, -122.169365],
];

/**
 * Defines a set of rules for automatically assigning categories to places based on keywords in their name and description.
 * Each rule consists of a `category` string and an array of `patterns` (regular expressions) to match against the combined name and description.
 * @readonly
 * @type {ReadonlyArray<{ category: string; patterns: RegExp[] }>}
 * @author Mike Odnis
 * @since 2023-10-27
 */
const categoryRules = [
  {
    category: 'Hackathon',
    patterns: [/\bhackathon\b/i, /hack(?!er\b)/i, /\bhacks?\b/i],
  },
  {
    category: 'Conference',
    patterns: [
      /\bconference\b/i,
      /\bdevfest\b/i,
      /\bsymposium\b/i,
      /\bfield day\b/i,
      /\bsummit\b/i,
      /\bworkshop\b/i,
    ],
  },
  {
    category: 'Research',
    patterns: [
      /\bresearch\b/i,
      /\bpresenter\b/i,
      /\bieee\b/i,
      /\bpaper\b/i,
      /\bpublication\b/i,
      /\bacademic\b/i,
    ],
  },
  {
    category: 'Tech Office',
    patterns: [
      /\boffice\b/i,
      /\bcompany visit\b/i,
      /\bvisited as part\b/i,
      /\b(jane street|squarespace|meta|amazon|microsoft)\b/i,
      /\bgoogle(?!.*devfest)/i,
    ],
  },
  {
    category: 'Mentorship',
    patterns: [
      /\bmentor(?!.*hack)/i,
      /\bjudge(?!.*hack)/i,
      /\bspeaker\b/i,
      /\bvolunteer(?!.*hack)/i,
      /\bpanelist\b/i,
    ],
  },
] as const;

/**
 * Assigns a category to a place based on keywords found in its name and description.
 * It iterates through predefined `categoryRules` and returns the first matching category.
 * If no specific rule matches, it defaults to 'Event'.
 * @param {string} name - The name of the place.
 * @param {string} description - The description of the place.
 * @returns {string} The determined category for the place.
 * @example
 * ```typescript
 * assignCategory('Treehacks', 'Mentor'); // Returns 'Mentorship'
 * assignCategory('Google DevFest', 'Annual developer conference'); // Returns 'Conference'
 * assignCategory('Local Cafe', 'Coffee shop'); // Returns 'Event'
 * ```
 * @author Mike Odnis
 * @since 2023-10-27
 */
const assignCategory = (name: string, description: string): string => {
  const combined = `${name} ${description}`.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.patterns.some((pattern) => pattern.test(combined))) {
      return rule.category;
    }
  }

  return 'Event';
};

/**
 * Determines if a place should be marked as "featured".
 * Currently, places are featured if their name matches any entry in a predefined list of major events.
 * @param {string} name - The name of the place.
 * @returns {boolean} True if the place should be featured, false otherwise.
 * @example
 * ```typescript
 * isFeatured('Treehacks'); // Returns true
 * isFeatured('Local Meetup'); // Returns false
 * ```
 * @author Mike Odnis
 * @since 2023-10-27
 */
const isFeatured = (name: string): boolean => {
  const majorEvents = ['Treehacks'];
  return majorEvents.some((event) => name.includes(event));
};

/**
 * An array of processed place data, transformed from `rawPlacesData` into `PlaceData` objects.
 * Each place is enriched with an assigned category, order, and featured status using helper functions.
 * @readonly
 * @type {PlaceData[]}
 * @author Mike Odnis
 * @see {@link rawPlacesData} for the source data.
 * @see {@link assignCategory} for how categories are determined.
 * @see {@link isFeatured} for how featured status is determined.
 * @since 2023-10-27
 */
const places: PlaceData[] = rawPlacesData.map((place, index) => {
  const [name, description, latitude, longitude] = place;
  return {
    _type: 'place',
    name,
    description,
    category: assignCategory(name, description),
    latitude,
    longitude,
    order: index + 1,
    featured: isFeatured(name),
  };
});

/**
 * Imports the processed places data into the Sanity CMS.
 * This asynchronous function iterates through the `places` array, creates a new document for each place in Sanity,
 * and logs the outcome. It performs an initial check for the `SANITY_API_TOKEN` environment variable.
 * @async
 * @returns {Promise<void>} A promise that resolves when all places have been imported, or rejects if an error occurs.
 * @throws {Error} If `SANITY_API_TOKEN` environment variable is not set, causing the script to exit.
 * @throws {Error} If any error occurs during the Sanity client `create` operation, causing the script to exit.
 * @example
 * ```typescript
 * // To run this script:
 * // 1. Ensure SANITY_API_TOKEN is set in your environment.
 * //    Example: export SANITY_API_TOKEN="sk..."
 * // 2. Execute the script:
 * //    bun run bin/populate-places.ts
 * ```
 * @author Mike Odnis
 * @see {@link https://mikeodnis.sanity.studio/ Sanity Studio} to view imported places.
 * @since 2023-10-27
 */
async function importPlaces() {
  console.log('📍 Starting import of places data to Sanity...\n');

  if (!process.env.SANITY_API_TOKEN) {
    console.error('❌ Error: SANITY_API_TOKEN environment variable is not set');
    console.log('\nTo get a token:');
    console.log('1. Go to https://www.sanity.io/manage/personal/tokens');
    console.log('2. Create a new token with "Editor" permissions');
    console.log('3. Set it: export SANITY_API_TOKEN="your-token-here"');
    process.exit(1);
  }

  try {
    for (const place of places) {
      console.log(`🗺️  Creating: ${place.name}...`);

      const result = await client.create(place);

      console.log(`✅ Created with ID: ${result._id}`);
      console.log(`   Category: ${place.category}`);
      console.log(`   Location: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`);
      console.log(`   Featured: ${place.featured ? 'Yes' : 'No'}`);
      console.log('');
    }

    console.log('✨ All places imported successfully!\n');
    console.log(`📊 Total places created: ${places.length}`);
    console.log('🌐 View them at: https://mikeodnis.sanity.studio/');
    console.log('\n📝 Next steps:');
    console.log('1. Visit Sanity Studio and add photos to your places');
    console.log('2. Adjust categories if the auto-assignment needs tweaking');
    console.log('3. Mark additional places as featured if desired');
  } catch (error) {
    console.error('❌ Error importing places:', error);
    process.exit(1);
  }
}

// Run the import
importPlaces();
