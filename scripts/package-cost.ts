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
 * @file This script analyzes the installed dependencies of a project, fetches their unpacked sizes from the npm registry,
 *       and categorizes them into high, medium, and low size tiers based on predefined thresholds.
 *       The results, organized by category, are then saved as individual JSON files in a specified output directory.
 * @author Your Name <your.email@example.com>
 * @since 1.0.0
 * @version 1.0.0
 * @see {@link https://docs.npmjs.com/cli/v9/commands/npm-view|npm view documentation}
 */

import { Stringify } from '@/utils';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageJson } from 'type-fest';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
const dependencies = Object.keys(packageJson.dependencies || {});
const devDependencies = Object.keys(packageJson.devDependencies || {});
const allDependencies = [...dependencies, ...devDependencies];

/**
 * @readonly
 * @description The absolute path to the output directory where the categorized package size JSON files will be saved.
 */
const OUTPUT_DIR = `${process.cwd()}/scripts/out`;

/**
 * Fetches the unpacked size of a given package from the npm registry.
 *
 * This function executes `npm view` to query the `dist.unpackedSize` property of a package.
 * The size is returned in bytes. If the package cannot be found, `npm view` fails, or
 * the result cannot be parsed, an error is logged to `console.error` and `null` is returned.
 *
 * @author Your Name
 * @since 1.0.0
 * @param {string} packageName - The name of the package to query (e.g., 'react', 'lodash').
 * @returns {{ name: string; size: number } | null} An object containing the package name and its unpacked size in bytes, or `null` if the size could not be retrieved.
 * @throws {Error} Although errors from `execSync` are caught and logged, the underlying `execSync` call can throw an error if the command fails to execute.
 * @example
 * // Successfully retrieves package size:
 * // getPackageSize('express'); // Returns { name: 'express', size: 220000 }
 * @example
 * // Fails to retrieve package size for a non-existent package:
 * // getPackageSize('non-existent-package-xyz'); // Returns null and logs an error to console.
 * @see {@link https://docs.npmjs.com/cli/v9/commands/npm-view|npm view documentation}
 */
const getPackageSize = (packageName: string): { name: string; size: number } | null => {
  try {
    const result = execSync(`npm view ${packageName} dist.unpackedSize --json`, {
      encoding: 'utf-8',
    });
    const size = JSON.parse(result) as number;
    return {
      name: packageName,
      size: size,
    };
  } catch (error) {
    console.error(
      `Failed to get size for ${packageName}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

/**
 * A type guard function that asserts a value is not `null`.
 * This is useful for filtering arrays and narrowing down TypeScript types.
 *
 * @template Value The type of the value being checked.
 * @since 1.0.0
 * @param {Value} value - The value to check.
 * @returns {value is Exclude<Value, null>} `true` if the value is not `null`, `false` otherwise.
 * @example
 * // Using with Array.prototype.filter:
 * // const items: (string | null)[] = ['apple', null, 'banana'];
 * // const nonNullItems: string[] = items.filter(isNotNull); // nonNullItems is ['apple', 'banana']
 */
const isNotNull = <Value>(value: Value): value is Exclude<Value, null> => {
  return value !== null;
};

const packageSizes = allDependencies
  .map((packageName) => getPackageSize(packageName))
  .filter(Boolean)
  .filter(isNotNull);

const sortedPackageSizes = packageSizes.toSorted((a, b) => b.size - a.size);

/**
 * @readonly
 * @description The threshold (in bytes) for categorizing packages as 'low' size. Packages up to this size are considered low. (1 MB)
 * @type {number}
 */
const LOW_THRESHOLD = 1_000_000; // 1 MB
/**
 * @readonly
 * @description The threshold (in bytes) for categorizing packages as 'medium' size. Packages between `LOW_THRESHOLD` and this size are considered medium. (10 MB)
 * @type {number}
 */
const MEDIUM_THRESHOLD = 10_000_000; // 10 MB

const categorizedPackages = {
  high: sortedPackageSizes.filter((pkg) => pkg.size > MEDIUM_THRESHOLD),
  medium: sortedPackageSizes.filter(
    (pkg) => pkg.size > LOW_THRESHOLD && pkg.size <= MEDIUM_THRESHOLD,
  ),
  low: sortedPackageSizes.filter((pkg) => pkg.size <= LOW_THRESHOLD),
};

// Ensure the output directory exists, creating it if necessary.
mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Writes the list of package names categorized as 'high' size to a JSON file.
 * The file is saved in the {@link OUTPUT_DIR} as `high.json`.
 *
 * @example
 * // To import this file in another module:
 * // import highPackages from './out/high.json' assert { type: 'json' };
 * @see {@link OUTPUT_DIR}
 */
writeFileSync(
  `${OUTPUT_DIR}/high.json`,
  Stringify([...categorizedPackages.high].map((e) => e.name)),
  {
    flag: 'w',
  },
);

/**
 * Writes the list of package names categorized as 'medium' size to a JSON file.
 * The file is saved in the {@link OUTPUT_DIR} as `medium.json`.
 *
 * @example
 * // To import this file in another module:
 * // import mediumPackages from './out/medium.json' assert { type: 'json' };
 * @see {@link OUTPUT_DIR}
 */
writeFileSync(
  `${OUTPUT_DIR}/medium.json`,
  Stringify([...categorizedPackages.medium].map((e) => e.name)),
  {
    flag: 'w',
  },
);

/**
 * Writes the list of package names categorized as 'low' size to a JSON file.
 * The file is saved in the {@link OUTPUT_DIR} as `low.json`.
 *
 * @example
 * // To import this file in another module:
 * // import lowPackages from './out/low.json' assert { type: 'json' };
 * @see {@link OUTPUT_DIR}
 */
writeFileSync(
  `${OUTPUT_DIR}/low.json`,
  Stringify([...categorizedPackages.low].map((e) => e.name)),
  {
    flag: 'w',
  },
);

console.log('\n📦 Package Size Summary:');
console.log(`   🔴 High (> 10 MB): ${categorizedPackages.high.length} packages`);
console.log(`   🟡 Medium (1-10 MB): ${categorizedPackages.medium.length} packages`);
console.log(`   🟢 Low (< 1 MB): ${categorizedPackages.low.length} packages`);
console.log(
  `\n📊 Total size: ${(sortedPackageSizes.reduce((sum, pkg) => sum + pkg.size, 0) / 1_000_000).toFixed(2)} MB`,
);
console.log(`\n📄 Results saved to ${OUTPUT_DIR}/package-sizes.json`);
