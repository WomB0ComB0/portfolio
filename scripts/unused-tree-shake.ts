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
 * @fileoverview This script executes `bunx tsr` to automatically format TypeScript/TSX files
 * within specified directories.
 *
 * @module tsr-formatter
 *
 * Asynchronously executes the `bunx tsr` command to automatically format TypeScript/TSX files
 * within specified directories (`src/` and `packages/`).
 *
 * This self-executing anonymous function orchestrates the formatting process by
 * invoking `node:child_process.execSync` with a carefully constructed command string.
 *
 * The `tsr` (TypeScript Refactor) command is configured with the following options:
 * - `--write`: Modifies the files in place with the refactoring results.
 * - `--recursive`: Recursively processes files within the specified paths.
 * - `'^src/.*\\.(ts|tsx)$'`: Targets TypeScript/TSX files located under the `src/` directory.
 * - `'^packages/.*\\.(ts|tsx)$'`: Targets TypeScript/TSX files located under any `packages/` directory.
 * - `--exclude '^[^/]+\\.ts$'`: Excludes standalone `.ts` files directly in the root directory
 *                                (e.g., `index.ts` if not in `src/`).
 * - `--exclude '^\\.[^/]+/'`: Excludes files/directories starting with a dot (e.g., `.next/`, `.git/`, etc.).
 * - `--exclude 'node_modules/'`: Excludes files within `node_modules` directories.
 *
 * The standard output produced by the `bunx tsr` command is captured and logged to the console.
 *
 * @async
 * @function
 * @returns {Promise<void>} A promise that resolves once the `tsr` command has executed,
 *                          its output has been processed, and logged to the console.
 * @throws {Error} Throws an `Error` if the underlying `child_process.execSync` call fails.
 *                 This could happen if `bunx` or `tsr` are not found, or if the `tsr` command
 *                 itself exits with a non-zero status code due to a formatting error or configuration issue.
 *                 The error object will typically contain `stdout` and `stderr` properties from the child process.
 * @example
 * ```typescript
 * // To execute this script using Bun:
 * // bun run script.ts
 * //
 * // Ensure `bunx tsr` is available in your environment.
 * ```
 * @see {@link https://github.com/microsoft/TypeScript/wiki/Using-the-TypeScript-Refactoring-Tools} For official documentation on TypeScript Refactoring Tools (`tsr`).
 * @see {@link https://nodejs.org/docs/latest/api/child_process.html#child_processexecsynccommand-options} For details on `Node.js child_process.execSync`.
 * @author Mike Odnis
 * @since 1.0.0
 * @version 1.0.0
 */
export default (async () =>
  console.log(
    (await import('node:child_process'))
      .execSync(
        [
          'bunx tsr',
          '--write',
          '--recursive',
          // pass entrypoints that represent roots of your graphs
          // (e.g. app/pages, feature entry files, etc.)
          "'^src/(main|index)\\.ts$'",
          "'^src/app/.*\\.(ts|tsx)$'",
          // no --exclude (tsr does not support it)
          // use tsconfig to scope files instead
        ].join(' '),
        { encoding: 'utf-8', shell: '/bin/bash' },
      )
      .toString(),
  ))();
