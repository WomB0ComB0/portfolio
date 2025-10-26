'use client';

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
 * Sanity Studio configuration for standalone deployment at https://<hostname>.sanity.studio/
 * This config is used only for building and deploying the standalone studio via `bunx sanity deploy`
 */

import { visionTool } from '@sanity/vision';
import type { PluginOptions } from 'sanity';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
// Import schema and structure
import { schema } from './src/sanity/schemaTypes';
import { structure } from './src/sanity/structure';

// Hardcoded values for standalone deployment
// These are safe to expose as they're public client-side values
// In Next.js app: process.env values will be injected at build time
// In standalone deployment: fallback values ensure studio works
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '34jrnkds';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-10-15';

// @ts-expect-error
export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  // Add and edit the content schema in the './sanity/schemaTypes' folder
  schema,
  plugins: [
    structureTool({ structure }),
    // Vision is for querying with GROQ from inside the Studio
    // https://www.sanity.io/docs/the-vision-plugin
    visionTool({ defaultApiVersion: apiVersion }),
  ],
} as unknown as PluginOptions);
