/**
 * Standalone Sanity Studio configuration for deployment
 * This config is used when deploying to sanity.studio hosting
 * Run: bunx sanity deploy --config sanity.config.deploy.ts
 */

import { visionTool } from '@sanity/vision';
import type { PluginOptions } from 'sanity';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';

// Direct imports without Next.js path aliases
import { certificationType } from './src/sanity/schemaTypes/certification';
import { experienceType } from './src/sanity/schemaTypes/experience';
import { placeType } from './src/sanity/schemaTypes/place';
import { projectType } from './src/sanity/schemaTypes/project';
import { resumeType } from './src/sanity/schemaTypes/resume';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-10-15';

// @ts-expect-error
export default defineConfig({
  name: 'default',
  title: 'Mike Odnis Portfolio',

  projectId,
  dataset,

  schema: {
    types: [certificationType, experienceType, projectType, resumeType, placeType],
  },

  plugins: [structureTool(), visionTool({ defaultApiVersion: apiVersion })],
} as unknown as PluginOptions);
