#!/usr/bin/env bun

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
 * @file Cleanup Script
 * @module scripts/cleanup
 * @description This script orchestrates the removal of various build artifacts, cache directories, and temporary files
 *              to ensure a clean development environment. It helps in resolving potential issues caused by stale
 *              cache or build data and prepares the project for a fresh build.
 * @version 1.0.0
 * @since  1.0.0
 * @example
 * To run this cleanup script from your project root:
 * ```bash
 * bun scripts/cleanup.ts
 * ```
 * @see {@link https://bun.sh/docs/runtime/exec `bun $` utility documentation} for details on command execution.
 */

import { $ } from 'bun';

/**
 * Executes a series of cleanup tasks to remove build artifacts, cache directories, and other temporary files
 * from the project.
 *
 * This function systematically clears:
 * 1. Next.js build output and cache (`.next` directory).
 * 2. TypeScript build information (`tsconfig.tsbuildinfo` file).
 * 3. Test coverage reports and Vitest cache (`coverage` and `.vitest` directories).
 *
 * Each task's execution status is logged to the console, indicating success or if it was skipped due to an error.
 * Upon completion, it provides helpful next steps for the developer.
 *
 * @public
 * @async
 * @returns {Promise<void>} A promise that resolves when all cleanup tasks have been attempted.
 * @throws {Error} Although individual task failures are caught and logged, an unhandled error during
 *                 the execution of the script itself (e.g., critical Bun runtime error) would cause
 *                 this promise to reject.
 * @example
 * // To invoke the cleanup process programmatically (e.g., from another script):
 * await cleanup();
 * @version 1.0.0
 * @since 1.0.0
 * @see {@link module:src/__tests__/type-check.ts The type-check script} for verifying TypeScript types.
 * @see {@link module:src/__tests__/api-manual-test.ts The API manual test script} for testing API endpoints.
 */
async function cleanup(): Promise<void> {
  console.log('🧹 Starting cleanup...\n');

  const tasks = [
    {
      name: 'Clear Next.js cache',
      command: 'rm -rf .next',
    },
    {
      name: 'Clear TypeScript build info',
      command: 'rm -rf tsconfig.tsbuildinfo',
    },
    {
      name: 'Clear test cache',
      command: 'rm -rf coverage .vitest',
    },
  ];

  for (const task of tasks) {
    try {
      console.log(`📦 ${task.name}...`);
      await $`${task.command.split(' ')}`;
      console.log(`   ✅ Done\n`);
    } catch (error: unknown) {
      console.log(`   ⚠️  Skipped (${error instanceof Error ? error.message : 'error'})\n`);
    }
  }

  console.log('✨ Cleanup complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Restart dev server: nr dev');
  console.log('   2. Run type checks: bun src/__tests__/type-check.ts');
  console.log('   3. Test APIs: bun src/__tests__/api-manual-test.ts\n');
}

cleanup().catch(console.error);
