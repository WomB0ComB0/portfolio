#!/usr/bin/env tsx
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

import fs from 'node:fs';
import path from 'node:path';
import { $ } from 'bun';
import depcheck from 'depcheck';
import type { PackageJson } from 'type-fest';
import { Stringify } from '@/utils';

/**
 * @file This script automates dependency checking for a TypeScript project using `depcheck`.
 * It identifies unused, missing, and potentially unused sub-dependencies,
 * and outputs the findings to JSON files in a specified output directory.
 * @author Mike Odnis
 * @since 1.0.0
 * @version 1.0.0
 * @see {@link https://github.com/depcheck/depcheck} for `depcheck` documentation.
 * @example
 * // To run this script from the project root:
 * // bun tsx ./scripts/check-dependencies.ts
 */

/**
 * @readonly
 * @description The root directory of the project. This is determined by navigating up one level from the current script's directory.
 * @type {string}
 */
const rootDir = path.join(__dirname, '..'); // Go up one level to project root

/**
 * @readonly
 * @description The full path to the project's `package.json` file.
 * @type {string}
 */
const packageJsonPath = path.join(rootDir, 'package.json');
console.log('Checking:', packageJsonPath);

/**
 * @description The parsed content of the project's `package.json` file.
 * @type {PackageJson}
 */
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;

/**
 * @readonly
 * @description The output directory where generated dependency reports will be stored.
 * @type {string}
 */
const OUTPUT_DIR = './bin/out';

/**
 * @description Configuration options for the `depcheck` utility.
 * @property {string[]} ignoreMatches - A list of dependency patterns to ignore, often common false positives like `@types/*` or build tools.
 * @property {string[]} ignorePatterns - A list of file or directory patterns to ignore during dependency analysis (e.g., build outputs, node_modules).
 * @property {boolean} skipMissing - If true, missing dependencies will be ignored. Set to false to report them.
 * @type {object}
 */
const options = {
  ignoreMatches: [
    // Common false positives
    '@types/*',
    'typescript',
    'autoprefixer',
    'postcss',
    'tailwindcss',
    'eslint*',
    'prettier*',
  ],
  ignorePatterns: [
    'dist',
    'build',
    '.next',
    'public',
    'node_modules',
    'coverage',
    'bin',
    'out',
    '.next',
    '.vscode',
    'prisma',
    '.idea',
    '.github',
  ],
  skipMissing: false,
};

/**
 * @description Checks if 'depcheck' is installed in the local `node_modules` directory.
 * If not found, it attempts to install 'depcheck' using `npm install`.
 * This ensures the script has 'depcheck' available, preventing runtime errors.
 * @async
 * @throws {Error} If `npm install depcheck` command fails.
 * @see {@link https://bun.sh/docs/api/exec} for Bun's `$()` API documentation.
 */
if (!fs.existsSync('./node_modules/depcheck')) {
  $`npm install depcheck`;
}

/**
 * Runs `depcheck` on the project's root directory to identify unused and missing dependencies.
 * It then processes the results, writes them to JSON files, and performs an additional check
 * for potentially unused sub-dependencies by iterating through direct dependencies.
 *
 * @async
 * @param {string} rootDir - The root directory of the project to check.
 * @param {object} options - Configuration options for `depcheck`.
 * @returns {Promise<void>} A promise that resolves when all dependency checks are complete and reports are written, or rejects if an error occurs.
 * @throws {Error} If `depcheck` encounters an error during analysis or if file write operations fail.
 * @author Your Name
 * @since 1.0.0
 * @version 1.0.0
 * @example
 * // The entire script demonstrates an example of running depcheck and processing its output.
 * // This function is implicitly called when the script executes.
 */
depcheck(rootDir, options)
  .then(
    (unused: {
      dependencies: string[];
      devDependencies: string[];
      missing: { [key: string]: string[] };
    }) => {
      console.log('\nUnused Dependencies:');
      /**
       * @description Writes the list of unused direct dependencies found by `depcheck` to a JSON file.
       * @param {string} filePath - The path to the output JSON file, e.g., `./bin/out/unused-dependencies.json`.
       * @param {string} content - The JSON stringified array of unused direct dependency names.
       */
      fs.writeFileSync(`${OUTPUT_DIR}/unused-dependencies.json`, Stringify(unused.dependencies));

      console.log('\nUnused DevDependencies:');
      /**
       * @description Writes the list of unused development dependencies found by `depcheck` to a JSON file.
       * @param {string} filePath - The path to the output JSON file, e.g., `./bin/out/unused-dev-dependencies.json`.
       * @param {string} content - The JSON stringified array of unused development dependency names.
       */
      fs.writeFileSync(
        `${OUTPUT_DIR}/unused-dev-dependencies.json`,
        Stringify(unused.devDependencies),
      );

      console.log('\nMissing Dependencies:');
      /**
       * @description Writes the list of missing dependencies (dependencies used in code but not declared in `package.json`) to a JSON file.
       * @param {string} filePath - The path to the output JSON file, e.g., `./bin/out/missing-dependencies.json`.
       * @param {string} content - The JSON stringified object where keys are missing dependency names and values are arrays of files where they are used.
       */
      fs.writeFileSync(`${OUTPUT_DIR}/missing-dependencies.json`, Stringify(unused.missing));

      /**
       * @description Combines all direct and development dependencies listed in the project's `package.json`.
       * This array represents all top-level dependencies declared by the project.
       * @type {string[]}
       */
      const allDependencies = Object.keys(packageJson.dependencies || {}).concat(
        Object.keys(packageJson.devDependencies || {}),
      );

      /**
       * @description Filters `allDependencies` to identify those that `depcheck` has determined are actually in use
       * within the project's source code. This excludes dependencies marked as unused by `depcheck`.
       * @type {string[]}
       */
      const usedDependencies = allDependencies.filter(
        (dep) => !unused.dependencies.includes(dep) && !unused.devDependencies.includes(dep),
      );

      console.log('\nChecking sub-dependencies...');
      /**
       * @description Iterates through each `usedDependency` to find potential unused sub-dependencies.
       * For each used direct dependency, it reads its `package.json` to get its own direct dependencies.
       * If a sub-dependency is not found in the project's `allDependencies` (top-level) and is not flagged
       * as a `missing` dependency by `depcheck`, it's considered a potentially unused sub-dependency.
       * These are then appended to `unused-sub-dependencies.json`.
       */
      usedDependencies.forEach((dep) => {
        /**
         * @description The file path to the `package.json` of the current direct dependency being examined.
         * @type {string}
         */
        const depPackageJsonPath = path.join(rootDir, 'node_modules', dep, 'package.json');
        if (fs.existsSync(depPackageJsonPath)) {
          /**
           * @description The parsed `package.json` content of the current direct dependency.
           * @type {PackageJson}
           */
          const depPackageJson = JSON.parse(
            fs.readFileSync(depPackageJsonPath, 'utf8'),
          ) as PackageJson;
          /**
           * @description An array of direct dependencies declared by the current dependency.
           * @type {string[]}
           */
          const subDependencies = Object.keys(depPackageJson.dependencies || {});

          subDependencies.forEach((subDep) => {
            /**
             * @description Appends a potentially unused sub-dependency to the `unused-sub-dependencies.json` file.
             * A sub-dependency is considered potentially unused if it is a dependency of a direct project dependency,
             * but is not itself a direct (or dev) dependency of the main project, and is also not listed as a missing
             * dependency by `depcheck` (which would imply it *is* used by the main project).
             * @param {string} filePath - The path to the output JSON file, e.g., `./bin/out/unused-sub-dependencies.json`.
             * @param {string} content - The sub-dependency name formatted as a JSON string item, followed by a newline.
             */
            if (!allDependencies.includes(subDep) && !unused.missing[subDep]) {
              fs.appendFileSync(`${OUTPUT_DIR}/unused-sub-dependencies.json`, `"${subDep}",\n`);
            }
          });
        }
      });
    },
  )
  .catch((error: Error) => {
    /**
     * @description Catches and handles any errors that occur during the `depcheck` promise chain.
     * It logs the error message to the console and exits the process with a non-zero status code,
     * indicating a failure in the script execution.
     * @param {Error} error - The error object caught from the promise rejection.
     * @returns {void}
     * @throws {Error} This block handles and reports errors, but does not re-throw; it terminates the process.
     */
    console.error('Error running depcheck:', error);
    process.exit(1);
  });
