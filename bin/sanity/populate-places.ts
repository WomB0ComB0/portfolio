#!/usr/bin/env bun

/**
 * Script to import existing places data into Sanity CMS
 * Usage: bun run bin/populate-places.ts
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '34jrnkds',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

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

const rawPlacesData: Array<[string, string, number, number]> = [
  ['Treehacks', 'Mentor', 37.431314, -122.169365],
];

const categoryRules = [
  {
    category: 'Hackathon',
    patterns: [
      /\bhackathon\b/i,
      /hack(?!er\b)/i,
      /\bhacks?\b/i,
    ],
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

const assignCategory = (name: string, description: string): string => {
  const combined = `${name} ${description}`.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.patterns.some((pattern) => pattern.test(combined))) {
      return rule.category;
    }
  }

  return 'Event';
};

// Determine if a place should be featured (hackathons and major events)
const isFeatured = (name: string): boolean => {
  const majorEvents = ['Treehacks'];
  return majorEvents.some(event => name.includes(event));
};

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
