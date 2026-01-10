#!/usr/bin/env node

/**
 * Copyright 2025 Mike Odnis
 *
 * This script is a comprehensive tool to manage license headers in a source repository.
 * It has been optimized for performance by processing files in parallel and minimizing disk I/O.
 *
 * Features:
 * - Applies license headers to a wide variety of file types.
 * - Detects comment styles automatically.
 * - Finds files using git-ls-files (with a fallback to glob).
 * - Excludes files based on command-line arguments.
 * - Can overwrite existing headers with --force.
 * - Can check for missing headers with --check.
 * - Supports dry-runs to preview changes.
 */

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
// --- Imports ---
import fg from 'fast-glob';
import kleur from 'kleur';
import { minimatch } from 'minimatch';

// --- Types and Constants ---

type LicenseType = 'apache-2.0' | 'mit' | 'gpl-3.0' | 'bsd-3-clause';

const PRESET_AUTHOR = 'Mike Odnis';

const VALID_LICENSES: readonly LicenseType[] = [
  'apache-2.0',
  'mit',
  'gpl-3.0',
  'bsd-3-clause',
] as const;

const LICENSE_TEMPLATES: Record<LicenseType, (author: string, year: string) => string> = {
  'apache-2.0': (author: string, year: string) => `Copyright ${year} ${author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,

  mit: (author: string, year: string) => `Copyright (c) ${year} ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

  'gpl-3.0': (author: string, year: string) => `Copyright (C) ${year} ${author}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,

  'bsd-3-clause': (author: string, year: string) => `Copyright (c) ${year}, ${author}
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
};

type CommentStyle =
  | { kind: 'block'; open: string; line: string; close: string }
  | { kind: 'line'; line: string };

interface FormatType {
  test: (path: string, content?: string) => boolean;
  style: CommentStyle;
  name: string;
}

const FORMAT_TYPES: FormatType[] = [
  {
    name: 'JavaScript/TypeScript',
    test: (p) => /\.[cm]?[jt]sx?$/i.test(p),
    style: { kind: 'block', open: '/**', line: ' *', close: ' */' },
  },
  {
    name: 'CSS/SCSS/LESS',
    test: (p) => /\.(s?css|less|styl)$/i.test(p),
    style: { kind: 'block', open: '/**', line: ' *', close: ' */' },
  },
  {
    name: 'C-family/Java/Kotlin/Swift',
    test: (p) => /\.(c|cc|cpp|h|hpp|cs|java|kt|kts|swift|m|mm)$/i.test(p),
    style: { kind: 'block', open: '/**', line: ' *', close: ' */' },
  },
  {
    name: 'Go/Rust/PHP/Dart/Scala',
    test: (p) => /\.(go|rs|php|dart|scala|groovy|gradle)$/i.test(p),
    style: { kind: 'block', open: '/**', line: ' *', close: ' */' },
  },
  {
    name: 'HTML/XML/Markdown',
    test: (p) => /\.(html?|xml|xhtml|svg|md|rst|xsl|xslt)$/i.test(p),
    style: { kind: 'block', open: '<!--', line: ' ', close: '-->' },
  },
  {
    name: 'AsciiDoc',
    test: (p) => /\.(adoc|asciidoc)$/i.test(p),
    style: { kind: 'block', open: '////', line: '', close: '////' },
  },
  {
    name: 'Shell/Python/Ruby/Perl',
    test: (p, c) =>
      /\.(sh|bash|zsh|py[w3]?|rb|pl|pm)$/i.test(p) ||
      /(^|\/)(Rakefile|Gemfile)$/i.test(p) ||
      !!c?.startsWith('#!/'),
    style: { kind: 'line', line: '#' },
  },
  {
    name: 'Config/Makefile/Dockerfile',
    test: (p) =>
      /\.(yml|yaml|toml|ini|cfg|conf|env|dotenv|mk|make)$/i.test(p) ||
      /(^|\/)(Makefile|Dockerfile|\.env|\.gitignore|\.dockerignore)$/i.test(p),
    style: { kind: 'line', line: '#' },
  },
  {
    name: 'SQL/Lua/Haskell',
    test: (p) => /\.(sql|lua|hs)$/i.test(p),
    style: { kind: 'line', line: '--' },
  },
];

const FALLBACK_EXCLUDES = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.lock',
  '**/*.log',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
] as const;

const HEADER_REGEX = /copyright\s*(\(c\)\s*)?\d{4}|SPDX-License-Identifier:/i;
const SHEBANG_REGEX = /^#![^\r\n]+/;

function isValidLicense(license: string): license is LicenseType {
  return VALID_LICENSES.includes(license as LicenseType);
}

// --- Argument Parsing ---

interface Args {
  license: LicenseType;
  author: string;
  year: string;
  force: boolean;
  dryRun: boolean;
  check: boolean;
  verbose: boolean;
  help: boolean;
  glob: string[];
  ext: string[];
  exclude: string[];
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      license: { type: 'string', short: 'l', default: 'mit' },
      author: { type: 'string', short: 'a', default: PRESET_AUTHOR },
      year: { type: 'string', short: 'y', default: new Date().getFullYear().toString() },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      glob: { type: 'string', multiple: true, default: [] },
      ext: { type: 'string', default: '' },
      exclude: { type: 'string', short: 'e', multiple: true, default: [] },
    },
  });

  const license = values.license;
  if (!isValidLicense(license)) {
    console.error(kleur.red(`Invalid license type: "${license}"`));
    console.error(kleur.gray(`Valid options: ${VALID_LICENSES.join(', ')}`));
    process.exit(1);
  }

  return {
    license,
    author: values.author ?? PRESET_AUTHOR,
    year: values.year ?? new Date().getFullYear().toString(),
    force: values.force ?? false,
    dryRun: values['dry-run'] ?? false,
    check: values.check ?? false,
    verbose: values.verbose ?? false,
    help: values.help ?? false,
    glob: values.glob ?? [],
    ext: (values.ext ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    exclude: values.exclude ?? [],
  };
}

function showHelp() {
  console.log(`
  Usage: copyright [options]

  A tool to apply license headers to source files.

  Options:
    -l, --license <type>    License type: ${VALID_LICENSES.join(', ')} (default: mit)
    -a, --author <name>     Author name for copyright
    -y, --year <year>       Copyright year (default: current year)
    --glob <pattern>        Glob pattern for files to process (can be used multiple times)
    --ext <extensions>      Comma-separated extensions to filter by (e.g., .ts,.js)
    -e, --exclude <pattern> Pattern to exclude files/folders (can be used multiple times)
    --force                 Overwrite existing license headers
    --dry-run               Show what would change without writing files
    --check                 Exit with an error if any files are missing headers
    -v, --verbose           Verbose output
    -h, --help              Show this help message
  `);
}

// --- File Discovery ---

function getGitFiles(): string[] {
  try {
    const stdout = execSync('git ls-files && git ls-files -o --exclude-standard', {
      encoding: 'utf8',
    });
    // Remove duplicates that can occur in edge cases
    return [...new Set(stdout.split('\n').filter(Boolean))];
  } catch {
    return [];
  }
}

function applyExcludePatterns(files: string[], excludePatterns: string[]): string[] {
  if (excludePatterns.length === 0) return files;
  return files.filter(
    (file) => !excludePatterns.some((pattern) => minimatch(file, pattern, { dot: true })),
  );
}

function filterByExtensions(files: string[], extensions: string[]): string[] {
  if (extensions.length === 0) return files;
  const extSet = new Set(extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)));
  return files.filter((file) => extSet.has(extname(file).toLowerCase()));
}

async function findFilesUsingGlob(
  patterns: string[],
  excludePatterns: string[],
  verbose: boolean,
): Promise<string[]> {
  if (verbose) console.log(kleur.gray(`  Searching with user-provided glob patterns...`));
  const ignore = [...FALLBACK_EXCLUDES, ...excludePatterns];

  // fast-glob supports multiple patterns directly
  const results = await fg(patterns, { onlyFiles: true, dot: true, ignore });

  // Remove duplicates
  return [...new Set(results)];
}

async function findFilesUsingGit(excludePatterns: string[], verbose: boolean): Promise<string[]> {
  const gitFiles = getGitFiles();
  if (gitFiles.length > 0) {
    if (verbose) {
      console.log(
        kleur.gray(`  Found ${gitFiles.length} files from git. Applying --exclude patterns...`),
      );
    }
    return applyExcludePatterns(gitFiles, excludePatterns);
  }

  console.warn(kleur.yellow('Not a git repository. Falling back to scanning all files.'));
  const ignore = [...FALLBACK_EXCLUDES, ...excludePatterns];
  if (verbose) {
    console.log(
      kleur.gray(`  Scanning all files with ${ignore.length} default ignore patterns...`),
    );
  }
  return await fg('**/*', { onlyFiles: true, dot: true, ignore });
}

async function findFilesToProcess(args: Args): Promise<string[]> {
  let files: string[];

  if (args.glob.length > 0) {
    files = await findFilesUsingGlob(args.glob, args.exclude, args.verbose);
  } else {
    files = await findFilesUsingGit(args.exclude, args.verbose);
  }

  if (args.verbose) {
    console.log(kleur.gray(`  Found ${files.length} files after initial discovery and filtering.`));
  }

  files = filterByExtensions(files, args.ext);

  if (args.verbose && args.ext.length > 0) {
    console.log(kleur.gray(`  Found ${files.length} files after filtering by extension.`));
  }

  return files;
}

// --- Header Logic ---

function buildHeader(
  style: CommentStyle,
  license: LicenseType,
  author: string,
  year: string,
): string {
  const body = LICENSE_TEMPLATES[license](author, year);
  const lines = body.split('\n');

  if (style.kind === 'block') {
    const content = lines.map((l) => `${style.line} ${l}`.trimEnd()).join('\n');
    return `${style.open}\n${content}\n${style.close}\n\n`;
  } else {
    const content = lines.map((l) => `${style.line} ${l}`.trimEnd()).join('\n');
    return `${content}\n\n`;
  }
}

function getFormatStyle(path: string, content: string): CommentStyle | null {
  const format = FORMAT_TYPES.find((f) => f.test(path, content));
  return format?.style ?? null;
}

function hasHeader(content: string): boolean {
  const first20Lines = content.split('\n').slice(0, 20).join('\n');
  return HEADER_REGEX.test(first20Lines);
}

/**
 * Extracts shebang from content if present.
 */
function extractShebang(content: string): { shebang: string; rest: string } {
  const shebangMatch = SHEBANG_REGEX.exec(content);
  if (shebangMatch) {
    return {
      shebang: shebangMatch[0] + '\n',
      rest: content.slice(shebangMatch[0].length).replace(/^\r?\n/, ''),
    };
  }
  return { shebang: '', rest: content };
}

/**
 * Block comment patterns for header stripping.
 */
const BLOCK_HEADER_PATTERNS = [
  /^\s*\/\*\*[\s\S]*?\*\/\s*\r?\n*/, // /** ... */
  /^\s*\/\*[\s\S]*?\*\/\s*\r?\n*/, // /* ... */
  /^\s*<!--[\s\S]*?-->\s*\r?\n*/, // <!-- ... -->
  /^\s*\/\/\/\/[\s\S]*?\/\/\/\/\s*\r?\n*/, // //// ... ////
] as const;

/**
 * Tries to strip a block comment header from content.
 */
function tryStripBlockHeader(content: string): string | null {
  for (const pattern of BLOCK_HEADER_PATTERNS) {
    const match = pattern.exec(content);
    if (match && HEADER_REGEX.test(match[0])) {
      return content.slice(match[0].length);
    }
  }
  return null;
}

/**
 * Classifies a line as comment, empty, or other.
 */
function classifyLine(line: string): 'comment' | 'empty' | 'other' {
  if (/^\s*(#|--|\/\/)/.test(line)) return 'comment';
  if (/^\s*$/.test(line)) return 'empty';
  return 'other';
}

/**
 * Determines the line header end index by scanning line comments.
 */
function findLineHeaderEndIndex(lines: string[]): number {
  let headerEndIndex = -1;
  let inHeader = false;
  const maxLines = Math.min(lines.length, 30);

  for (let i = 0; i < maxLines; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const lineType = classifyLine(line);

    if (lineType === 'comment') {
      inHeader = inHeader || HEADER_REGEX.test(line);
      if (inHeader) headerEndIndex = i;
    } else if (lineType === 'empty' && inHeader) {
      headerEndIndex = i;
    } else {
      break;
    }
  }

  return inHeader ? headerEndIndex : -1;
}

/**
 * Attempts to strip an existing license header from the content.
 * Returns the content with the header removed (preserving shebang if present).
 */
function stripExistingHeader(content: string): string {
  const { shebang, rest } = extractShebang(content);

  // Try block comment headers first
  const strippedBlock = tryStripBlockHeader(rest);
  if (strippedBlock !== null) {
    return shebang + strippedBlock;
  }

  // Try line comment headers
  const lines = rest.split('\n');
  const headerEndIndex = findLineHeaderEndIndex(lines);

  if (headerEndIndex >= 0) {
    const stripped = lines
      .slice(headerEndIndex + 1)
      .join('\n')
      .replace(/^\r?\n*/, '');
    return shebang + stripped;
  }

  return content;
}

function prependHeader(content: string, header: string): string {
  const shebangMatch = SHEBANG_REGEX.exec(content);
  if (shebangMatch) {
    const shebang = shebangMatch[0];
    const restOfContent = content.slice(shebang.length).replace(/^\r?\n*/, '');
    return `${shebang}\n\n${header}${restOfContent}`;
  }
  return header + content;
}

/**
 * Check if content appears to be binary (contains null bytes or high ratio of non-printable chars)
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes('\0')) return true;

  // Check first 1000 chars for high ratio of non-printable characters
  const sample = content.slice(0, 1000);
  let nonPrintable = 0;
  for (const char of sample) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code < 9 || (code > 13 && code < 32) || (code > 126 && code < 160)) {
      nonPrintable++;
    }
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.1;
}

type ProcessResult = {
  status: 'updated' | 'skipped' | 'missing' | 'error';
  path: string;
};

/**
 * Logs a skip message if verbose mode is enabled.
 */
function logSkip(verbose: boolean, reason: string, file: string): void {
  if (verbose) console.log(kleur.gray(`- Skipping ${reason}: ${file}`));
}

/**
 * Checks if a file should be skipped based on content validity.
 */
function shouldSkipFile(
  file: string,
  content: string,
  verbose: boolean,
): { skip: true; result: ProcessResult } | { skip: false } {
  if (content.trim().length === 0) {
    logSkip(verbose, 'empty file', file);
    return { skip: true, result: { status: 'skipped', path: file } };
  }

  if (isBinaryContent(content)) {
    logSkip(verbose, 'binary file', file);
    return { skip: true, result: { status: 'skipped', path: file } };
  }

  const style = getFormatStyle(file, content);
  if (!style) {
    logSkip(verbose, 'unsupported file', file);
    return { skip: true, result: { status: 'skipped', path: file } };
  }

  return { skip: false };
}

/**
 * Handles check mode logic for a file.
 */
function handleCheckMode(file: string, alreadyHasHeader: boolean, verbose: boolean): ProcessResult {
  if (alreadyHasHeader) {
    if (verbose) console.log(kleur.gray(`- Has header: ${file}`));
    return { status: 'skipped', path: file };
  }
  return { status: 'missing', path: file };
}

/**
 * Applies the license header to a file.
 */
async function applyHeader(
  file: string,
  content: string,
  args: Args,
  style: CommentStyle,
  alreadyHasHeader: boolean,
): Promise<ProcessResult> {
  let contentToProcess = content;

  if (alreadyHasHeader && args.force) {
    contentToProcess = stripExistingHeader(content);
    if (args.verbose) console.log(kleur.gray(`  Stripped existing header from: ${file}`));
  }

  const header = buildHeader(style, args.license, args.author, args.year);
  const newContent = prependHeader(contentToProcess, header);

  if (args.dryRun) {
    console.log(kleur.green(`  + Would update: ${file}`));
    return { status: 'updated', path: file };
  }

  await writeFile(file, newContent, 'utf8');
  if (args.verbose) console.log(kleur.green(`  + Updated: ${file}`));
  return { status: 'updated', path: file };
}

/**
 * Processes a single file for license header management.
 */
async function processFile(file: string, args: Args): Promise<ProcessResult> {
  try {
    const content = await readFile(file, 'utf8');

    const skipCheck = shouldSkipFile(file, content, args.verbose);
    if (skipCheck.skip) return skipCheck.result;

    const style = getFormatStyle(file, content);
    if (!style) {
      logSkip(args.verbose, 'unsupported file', file);
      return { status: 'skipped', path: file };
    }

    const alreadyHasHeader = hasHeader(content);

    if (args.check) {
      return handleCheckMode(file, alreadyHasHeader, args.verbose);
    }

    if (alreadyHasHeader && !args.force) {
      logSkip(args.verbose, '(has header)', file);
      return { status: 'skipped', path: file };
    }

    return await applyHeader(file, content, args, style, alreadyHasHeader);
  } catch (err) {
    console.error(
      kleur.red(`\nError processing ${file}: ${err instanceof Error ? err.message : String(err)}`),
    );
    return { status: 'error', path: file };
  }
}

/**
 * Prints the summary of processed files.
 */
function printSummary(results: ProcessResult[], args: Args): void {
  const summary = results.reduce(
    (acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    },
    {} as Record<ProcessResult['status'], number>,
  );

  const updated = summary.updated || 0;
  const skipped = summary.skipped || 0;
  const missing = summary.missing || 0;
  const errors = summary.error || 0;

  console.log(kleur.bold('\n--- Summary ---'));

  if (args.check) {
    if (missing > 0) {
      console.error(kleur.red(`❌ ${missing} files are missing license headers.`));
      process.exit(1);
    } else {
      console.log(kleur.green('✅ All files have license headers.'));
    }
  } else {
    console.log(kleur.green(`Updated: ${updated}`));
    console.log(kleur.gray(`Skipped: ${skipped}`));
    if (errors > 0) console.log(kleur.red(`Errors: ${errors}`));
    console.log(`Total processed: ${results.length}`);
  }
}

// --- Main Execution ---

async function main() {
  const args = parseCliArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log(kleur.bold().yellow(`Finding files...`));
  const files = await findFilesToProcess(args);

  if (files.length === 0) {
    console.log(kleur.gray('No files found to process.'));
    return;
  }

  console.log(`Found ${files.length} files. Checking for license headers...`);
  if (args.dryRun) console.log(kleur.cyan().bold('\n[DRY RUN MODE]'));
  if (args.force) console.log(kleur.magenta().bold('[FORCE MODE] Overwriting existing headers.'));

  const results: ProcessResult[] = await Promise.all(files.map((file) => processFile(file, args)));

  printSummary(results, args);
}

await main().catch((err) => {
  console.error(kleur.red('An unexpected fatal error occurred:'), err);
  process.exit(1);
});
