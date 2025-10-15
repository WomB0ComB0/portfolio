#!/usr/bin/env bun

/**
 * Script to import resume project data into Sanity CMS
 * Usage: bun run bin/import-resume-projects.ts
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

interface ProjectData {
  _type: 'project';
  title: string;
  slug: {
    _type: 'slug';
    current: string;
  };
  description: string;
  longDescription: string;
  category: string;
  technologies: string[];
  status: string;
  featured: boolean;
  liveUrl?: string;
  githubUrl?: string;
  startDate: string;
  endDate?: string;
  order: number;
}

const projects: ProjectData[] = [
  {
    _type: 'project',
    title: 'Lorem Ipsum Portfolio',
    slug: {
      _type: 'slug',
      current: 'lorem-ipsum-portfolio',
    },
    description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    longDescription: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
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
