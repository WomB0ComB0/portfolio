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
