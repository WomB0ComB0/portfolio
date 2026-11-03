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
 * This configuration file lets you run `$ sanity [command]` in this folder
 * Go to https://www.sanity.io/docs/cli to learn more.
 **/
import { defineCliConfig } from 'sanity/cli';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  deployment: {
    appId: 'tdcijr9jf7gyz3zllo3eis3k',
  },
  // Keep the Studio's Vite build away from the Next.js app's postcss.config.mjs.
  // Since sanity v6 the Studio bundles plain CSS (@portabletext/plugin-table), and
  // Vite rejects that config's Next.js-only string plugin form. An inline config
  // stops Vite from searching for one; the Studio needs no PostCSS plugins.
  vite: {
    css: { postcss: { plugins: [] } },
  },
});
