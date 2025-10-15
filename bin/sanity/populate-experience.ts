#!/usr/bin/env bun

/**
 * Script to import resume experience data into Sanity CMS
 * Usage: bun run bin/import-resume-experiences.ts
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN, // You'll need to set this
});

interface ExperienceData {
  _type: 'experience';
  position: string;
  company: string;
  companyUrl?: string;
  location?: string;
  description: string;
  responsibilities: string[];
  technologies: string[];
  startDate: string;
  endDate?: string;
  current: boolean;
  order: number;
}

const experiences: ExperienceData[] = [
  {
    _type: 'experience',
    position: 'Lorem Ipsum Developer',
    company: 'Dolor Sit',
    location: 'Remote',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
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

async function importExperiences() {
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
      console.log(`   ${experience.current ? '(Current Position)' : `End Date: ${experience.endDate}`}`);
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