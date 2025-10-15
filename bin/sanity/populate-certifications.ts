#!/usr/bin/env bun

/**
 * Script to import resume certification data into Sanity CMS
 * Usage: bun run bin/import-resume-certifications.ts
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

interface CertificationData {
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

const certifications: CertificationData[] = [
  {
    _type: 'certification',
    title: 'Lorem Ipsum Professional Certificate',
    issuer: 'Lorem Corporation',
    description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.',
    credentialUrl: 'https://www.lorem.org/certificates/ipsum-dolor-sit',
    issueDate: '2023-08-12',
    skills: ['Lorem', 'Ipsum', 'Dolor', 'Sit', 'Amet', 'Consectetur', 'Adipiscing'],
    order: 1,
  },
];

async function importCertifications() {
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
  } catch (error) {
    console.error('❌ Error importing certifications:', error);
    process.exit(1);
  }
}

// Run the import
importCertifications();
