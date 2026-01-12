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
 * Script to import media content (presentations, talks, articles, videos) into Sanity CMS.
 *
 * @file
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * // Usage:
 * // 1. Ensure SANITY_API_TOKEN is set in your environment.
 * //    export SANITY_API_TOKEN="sk..."
 * // 2. Run the script:
 * //    bun run bin/sanity/populate-media.ts
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '34jrnkds',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  useCdn: false,
  apiVersion: '2025-10-15',
  token: process.env.SANITY_API_TOKEN,
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PresentationData {
  _type: 'presentation';
  title: string;
  description: string;
  eventName: string;
  eventUrl?: string;
  date: string;
  slidesFormat:
    | 'pdf'
    | 'google_slides'
    | 'speakerdeck'
    | 'slideshare'
    | 'canva'
    | 'other_url'
    | 'none';
  slidesUrl?: string;
  videoUrl?: string;
  location?: string;
  tags?: string[];
  order: number;
}

interface TalkData {
  _type: 'talk';
  title: string;
  description: string;
  venue: string;
  date: string;
  videoFormat: 'youtube' | 'vimeo' | 'other' | 'none';
  videoUrl?: string;
  slidesFormat: 'pdf' | 'url' | 'none';
  slidesUrl?: string;
  duration?: string;
  tags?: string[];
  order: number;
}

interface ArticleData {
  _type: 'article';
  title: string;
  excerpt: string;
  publication: string;
  publicationUrl: string;
  publishedDate: string;
  coAuthors?: string[];
  tags?: string[];
  order: number;
}

interface YoutubeVideoData {
  _type: 'youtubeVideo';
  title: string;
  description: string;
  videoId: string;
  publishedDate: string;
  duration?: string;
  tags?: string[];
  order: number;
}

// ============================================================================
// SAMPLE DATA - Replace with your actual content
// ============================================================================

/**
 * Sample presentations - Replace with your actual presentations
 */
const presentations: PresentationData[] = [
  {
    _type: 'presentation',
    title: 'Building Scalable Web Applications with Next.js',
    description:
      'An in-depth look at best practices for building scalable, performant web applications using Next.js App Router, server components, and modern React patterns.',
    eventName: 'React NYC Meetup',
    eventUrl: 'https://www.meetup.com/ReactNYC/',
    date: '2025-03-15T18:00:00Z',
    slidesFormat: 'google_slides',
    slidesUrl: 'https://docs.google.com/presentation/d/example',
    videoUrl: 'https://www.youtube.com/watch?v=example',
    location: 'New York, NY',
    tags: ['Next.js', 'React', 'Performance', 'Web Development'],
    order: 1,
  },
  // Add more presentations here...
];

/**
 * Sample talks - Replace with your actual talks
 */
const talks: TalkData[] = [
  {
    _type: 'talk',
    title: 'The Future of AI in Web Development',
    description:
      'Exploring how artificial intelligence is transforming the way we build and deploy web applications.',
    venue: 'AI Summit 2025',
    date: '2025-04-05T10:00:00Z',
    videoFormat: 'youtube',
    videoUrl: 'https://www.youtube.com/watch?v=example',
    slidesFormat: 'url',
    slidesUrl: 'https://speakerdeck.com/example',
    tags: ['AI', 'Machine Learning', 'Web Development'],
    order: 1,
  },
  // Add more talks here...
];

/**
 * Sample articles - Replace with your actual articles
 */
const articles: ArticleData[] = [
  {
    _type: 'article',
    title: 'The Complete Guide to Modern State Management in React',
    excerpt:
      'An exploration of state management solutions in 2025, comparing Redux Toolkit, Zustand, Jotai, and the built-in React Context API.',
    publication: 'Smashing Magazine',
    publicationUrl: 'https://www.smashingmagazine.com/article/example',
    publishedDate: '2025-03-20T00:00:00Z',
    tags: ['React', 'State Management', 'JavaScript', 'Frontend'],
    coAuthors: [],
    order: 1,
  },
  // Add more articles here...
];

/**
 * Sample YouTube videos - Replace with your actual video IDs
 */
const youtubeVideos: YoutubeVideoData[] = [
  {
    _type: 'youtubeVideo',
    title: 'Getting Started with Next.js 15', // Will be replaced by YouTube API
    description: 'A comprehensive guide to the new features in Next.js 15.', // Will be replaced by YouTube API
    videoId: 'example_video_id', // Replace with actual YouTube video ID
    publishedDate: '2025-03-10T00:00:00Z',
    tags: ['Next.js', 'Tutorial', 'React'],
    order: 1,
  },
  // Add more videos here...
];

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

async function importPresentations() {
  console.log('📊 Importing presentations...');

  for (const presentation of presentations) {
    try {
      const result = await client.create(presentation);
      console.log(`  ✅ Created presentation: ${presentation.title} (${result._id})`);
    } catch (error) {
      console.error(`  ❌ Failed to create presentation: ${presentation.title}`, error);
    }
  }
}

async function importTalks() {
  console.log('🎤 Importing talks...');

  for (const talk of talks) {
    try {
      const result = await client.create(talk);
      console.log(`  ✅ Created talk: ${talk.title} (${result._id})`);
    } catch (error) {
      console.error(`  ❌ Failed to create talk: ${talk.title}`, error);
    }
  }
}

async function importArticles() {
  console.log('📝 Importing articles...');

  for (const article of articles) {
    try {
      const result = await client.create(article);
      console.log(`  ✅ Created article: ${article.title} (${result._id})`);
    } catch (error) {
      console.error(`  ❌ Failed to create article: ${article.title}`, error);
    }
  }
}

async function importYoutubeVideos() {
  console.log('🎥 Importing YouTube videos...');

  for (const video of youtubeVideos) {
    try {
      const result = await client.create(video);
      console.log(`  ✅ Created video: ${video.title} (${result._id})`);
    } catch (error) {
      console.error(`  ❌ Failed to create video: ${video.title}`, error);
    }
  }
}

async function clearExistingData(type: string) {
  console.log(`🗑️  Clearing existing ${type} documents...`);

  try {
    const query = `*[_type == "${type}"]._id`;
    const ids = await client.fetch<string[]>(query);

    if (ids.length === 0) {
      console.log(`  ℹ️  No existing ${type} documents found.`);
      return;
    }

    for (const id of ids) {
      await client.delete(id);
    }
    console.log(`  ✅ Deleted ${ids.length} ${type} document(s).`);
  } catch (error) {
    console.error(`  ❌ Failed to clear ${type} documents:`, error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('🚀 Starting Sanity Media Content Import\n');

if (!process.env.SANITY_API_TOKEN) {
  console.error('❌ Error: SANITY_API_TOKEN environment variable is not set.');
  console.error('   Please set it with: export SANITY_API_TOKEN="sk..."');
  process.exit(1);
}

const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const importType =
  args.find((arg) => ['presentations', 'talks', 'articles', 'videos', 'all'].includes(arg)) ||
  'all';

console.log(`📋 Import type: ${importType}`);
console.log(`🗑️  Clear existing: ${shouldClear}\n`);

try {
  if (importType === 'all' || importType === 'presentations') {
    if (shouldClear) await clearExistingData('presentation');
    await importPresentations();
    console.log('');
  }

  if (importType === 'all' || importType === 'talks') {
    if (shouldClear) await clearExistingData('talk');
    await importTalks();
    console.log('');
  }

  if (importType === 'all' || importType === 'articles') {
    if (shouldClear) await clearExistingData('article');
    await importArticles();
    console.log('');
  }

  if (importType === 'all' || importType === 'videos') {
    if (shouldClear) await clearExistingData('youtubeVideo');
    await importYoutubeVideos();
    console.log('');
  }

  console.log('✨ Import complete!\n');
  console.log('📌 Next steps:');
  console.log('   1. Open Sanity Studio: bun run sanity:dev');
  console.log('   2. Review and edit the imported content');
  console.log('   3. Your media page will automatically show the real data');
} catch (error) {
  console.error('❌ Import failed:', error);
  process.exit(1);
}
