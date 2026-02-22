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
 * @file This script analyzes the installed dependencies of a project, fetches their unpacked sizes from the npm registry
 *       in parallel batches for performance, and categorizes them into high, medium, and low size tiers.
 *       The results are saved as individual JSON files in a specified output directory.
 * @since 1.0.0
 * @version 1.1.0
 */

import { Stringify } from '@/utils';
import { exec } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PackageJson } from 'type-fest';

const execPromise = promisify(exec);

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
const dependencies = Object.keys(packageJson.dependencies || {});
const devDependencies = Object.keys(packageJson.devDependencies || {});
const allDependencies = [...dependencies, ...devDependencies];

const OUTPUT_DIR = `${process.cwd()}/scripts/out`;

/**
 * Fetches the unpacked size of a given package from the npm registry.
 */
const getPackageSize = async (packageName: string): Promise<{ name: string; size: number } | null> => {
  try {
    const { stdout } = await execPromise(`npm view ${packageName} dist.unpackedSize --json`);
    const size = JSON.parse(stdout) as number;
    return {
      name: packageName,
      size: size || 0,
    };
  } catch (error) {
    console.error(
      `Failed to get size for ${packageName}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

const isNotNull = <Value>(value: Value): value is Exclude<Value, null> => {
  return value !== null;
};

// Batch processing to avoid overwhelming the system and registry
const BATCH_SIZE = 10;
const results: { name: string; size: number }[] = [];

console.log(`🚀 Starting package cost analysis for ${allDependencies.length} packages...`);

for (let i = 0; i < allDependencies.length; i += BATCH_SIZE) {
  const batch = allDependencies.slice(i, i + BATCH_SIZE);
  console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allDependencies.length / BATCH_SIZE)}...`);
  const batchResults = await Promise.all(batch.map(getPackageSize));
  results.push(...batchResults.filter(isNotNull));
}

const sortedPackageSizes = results.toSorted((a, b) => b.size - a.size);

const LOW_THRESHOLD = 1_000_000; // 1 MB
const MEDIUM_THRESHOLD = 10_000_000; // 10 MB

const categorizedPackages = {
  high: sortedPackageSizes.filter((pkg) => pkg.size > MEDIUM_THRESHOLD),
  medium: sortedPackageSizes.filter(
    (pkg) => pkg.size > LOW_THRESHOLD && pkg.size <= MEDIUM_THRESHOLD,
  ),
  low: sortedPackageSizes.filter((pkg) => pkg.size <= LOW_THRESHOLD),
};

// Ensure the output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

// Write results
writeFileSync(
  `${OUTPUT_DIR}/high.json`,
  Stringify([...categorizedPackages.high].map((e) => e.name)),
  { flag: 'w' }
);
writeFileSync(
  `${OUTPUT_DIR}/medium.json`,
  Stringify([...categorizedPackages.medium].map((e) => e.name)),
  { flag: 'w' }
);
writeFileSync(
  `${OUTPUT_DIR}/low.json`,
  Stringify([...categorizedPackages.low].map((e) => e.name)),
  { flag: 'w' }
);

console.log('\n📦 Package Size Summary:');
console.log(`   🔴 High (> 10 MB): ${categorizedPackages.high.length} packages`);
console.log(`   🟡 Medium (1-10 MB): ${categorizedPackages.medium.length} packages`);
console.log(`   🟢 Low (< 1 MB): ${categorizedPackages.low.length} packages`);
console.log(
  `\n📊 Total size: ${(sortedPackageSizes.reduce((sum, pkg) => sum + pkg.size, 0) / 1_000_000).toFixed(2)} MB`,
);
console.log(`\n📄 Results saved to ${OUTPUT_DIR}/`);
