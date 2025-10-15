/**
 * Standalone Sanity Studio configuration for deployment
 * This config is used when deploying to sanity.studio hosting
 * Run: bunx sanity deploy --config sanity.config.deploy.ts
 */

import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import type { PluginOptions } from 'sanity'

// Direct imports without Next.js path aliases
import { certificationType } from './src/sanity/schemaTypes/certification'
import { experienceType } from './src/sanity/schemaTypes/experience'
import { projectType } from './src/sanity/schemaTypes/project'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-10-15'
// @ts-ignore
export default defineConfig({
  name: 'default',
  title: 'Mike Odnis Portfolio',
  
  projectId,
  dataset,
  
  schema: {
    types: [
      certificationType,
      experienceType,
      projectType,
    ],
  },
  
  plugins: [
    structureTool(),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
} as unknown as PluginOptions)
