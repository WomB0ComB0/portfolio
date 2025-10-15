// @ts-ignore
'use client'

/**
 * Sanity Studio configuration for standalone deployment at https://<hostname>.sanity.studio/
 * This config is used only for building and deploying the standalone studio via `bunx sanity deploy`
 */

import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import type {PluginOptions} from 'sanity'
// Import schema and structure
import {schema} from './src/sanity/schemaTypes'
import {structure} from './src/sanity/structure'

// Hardcoded values for standalone deployment
// These are safe to expose as they're public client-side values
// In Next.js app: process.env values will be injected at build time
// In standalone deployment: fallback values ensure studio works
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '34jrnkds'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-10-15'

// @ts-ignore
export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  // Add and edit the content schema in the './sanity/schemaTypes' folder
  schema,
  plugins: [
    structureTool({structure}),
    // Vision is for querying with GROQ from inside the Studio
    // https://www.sanity.io/docs/the-vision-plugin
    visionTool({defaultApiVersion: apiVersion}),
  ],
} as unknown as PluginOptions)
