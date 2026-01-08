#!/usr/bin/env bun

// -*- typescript -*-

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
 * @file This script is designed to clean up the 'dependencies' section of a 'package.json' file.
 * It filters out any packages that are also listed in 'devDependencies', ensuring that
 * 'dependencies' only contains true production dependencies.
 * The modified 'package.json' is then written back to the file system.
 *
 * @author A Script Author
 * @since 2023-10-27
 * @version 1.0.0
 * @see {@link https://docs.npmjs.com/cli/v9/configuring-npm/package-json#dependencies}
 * @see {@link https://docs.npmjs.com/cli/v9/configuring-npm/package-json#devdependencies}
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageJson } from 'type-fest';
import { Stringify } from '@/utils';

/**
 * The root directory of the project, determined by navigating up two levels from the current script's directory.
 */
const rootDir = join(__dirname, '..');

/**
 * The absolute path to the project's `package.json` file.
 */
const packageJsonPath = join(rootDir, 'package.json');

/**
 * Parses the `package.json` file located at `packageJsonPath` and casts it to the `PackageJson` type.
 * @type {PackageJson}
 */
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;

/**
 * Retrieves the production dependencies from `packageJson.dependencies`.
 * @type {Record<string, string>}
 * @throws {Error} If no 'dependencies' object is found in `package.json`.
 */
const dependencies =
  packageJson.dependencies ||
  (() => {
    throw new Error('No dependencies found');
  })();

/**
 * Retrieves the development dependencies from `packageJson.devDependencies`.
 * @type {Record<string, string>}
 * @throws {Error} If no 'devDependencies' object is found in `package.json`.
 */
const devDependencies =
  packageJson.devDependencies ||
  (() => {
    throw new Error('No dev dependencies found');
  })();

/**
 * An object containing only the production dependencies, filtered from the original
 * 'dependencies' to exclude any packages also present in 'devDependencies'.
 * This ensures that the 'dependencies' list only contains true runtime requirements.
 *
 * The process involves:
 * 1. Extracting key-value pairs from the `dependencies` object.
 * 2. Filtering these pairs to exclude any package whose key exists in `devDependencies`.
 * 3. Reducing the filtered pairs back into a new object.
 * @type {Record<string, string>}
 */
const picked = {
  ...Object.entries(dependencies)
    .filter(([key, _]) => {
      return !devDependencies[key];
    })
    .map(([key, value]) => {
      return [key, value];
    })
    .reduce(
      (acc, [key, value]) => {
        if (!key || !value || acc[key]) return acc;
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    ),
};

/**
 * Main execution block:
 * This block runs only when the script is executed directly (not imported as a module).
 * It attempts to update the `dependencies` in `package.json` with the `picked` filtered list
 * and then writes the modified `package.json` back to the file system.
 */
if (require.main === module) {
  /**
   * Asynchronously updates the `package.json` with the filtered dependencies and saves it.
   * Handles potential errors during file write operations.
   * @async
   */
  (async () => {
    try {
      /**
       * Updates the 'dependencies' property of the loaded `packageJson` object
       * with the filtered list of dependencies (`picked`).
       */
      packageJson.dependencies = picked;
      /**
       * Writes the modified `packageJson` object back to the `package.json` file.
       * The `Stringify` utility is used for pretty-printing the JSON output.
       */
      writeFileSync(packageJsonPath, Stringify(packageJson));
    } catch (error) {
      /**
       * Catches and logs any errors that occur during the file write process.
       * Displays the error message to the console.
       */
      console.error(`${error instanceof Error ? error.message : error}`);
    } finally {
      /**
       * Ensures the process exits cleanly regardless of success or failure.
       */
      process.exit(0);
    }
  })();
}
