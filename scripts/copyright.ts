/**
 * Copyright 2024 Google LLC
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

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * Defines the structure for different file format types,
 * specifying how copyright headers should be applied.
 * @interface
 * @property {RegExp} regex - A regular expression to match file extensions for this format.
 * @property {string} [header] - The string to prepend to the copyright block (e.g., '/**', '<!--').
 * @property {string} body - The string to prepend to each line of the copyright body (e.g., ' *', '').
 * @property {string} [footer] - The string to append after the copyright block
 * @since 1.0.0
 * @version 1.0.0
 */
interface FormatType {
  regex: RegExp;
  header?: string;
  body: string;
  footer?: string;
}

/**
 * Standard file options used for reading/writing files, specifying UTF-8 encoding.
 * @readonly
 * @type {{ encoding: 'utf-8' }}
 */
const FILE_OPTS: { encoding: 'utf-8' } = { encoding: 'utf-8' } as const;
/**
 * An array of predefined file format configurations, each specifying
 * the regex to match file types and the corresponding header/body/footer
 * strings for copyright comments.
 * @readonly
 * @type {FormatType[]}
 */
const FORMAT_TYPES: FormatType[] = [
  { regex: /\.((ts)|(scss)|(js)|(tsx)|(css))$/, header: '/**', body: ' *', footer: ' */' },
  { regex: /\.html$/, header: '<!--', body: '', footer: '-->' },
  { regex: /\.sh$/, header: '#', body: '', footer: '' },
] as const;
/**
 * The standard copyright notice to be added to source files.
 * Includes the current year and Apache License 2.0 boilerplate.
 * @readonly
 * @type {string}
 */
const COPYRIGHT = ` Copyright ${new Date().getFullYear()} Mike Odnis

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.` as const;

/**
 * Checks if a file exists at the given path.
 * @param {string} path - The path to the file.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the file exists, `false` otherwise.
 * @async
 * @throws {Error} No explicit throw, but `readFile` can throw if permissions are an issue. Catches and returns false.
 * @example
 * await fileExists('./src/index.ts'); // Returns true or false
 */
const fileExists = async (path: string): Promise<boolean> => {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Retrieves a list of source files from the Git repository (tracked and untracked but not ignored)
 * that are missing a copyright header.
 * @returns {Promise<Array<{ contents: string; path: string; format: FormatType | undefined }>>}
 *   A promise that resolves to an array of objects, each containing the file's content,
 *   its path, and the determined format type, for files missing the copyright.
 * @async
 * @throws {Error} Throws if `execSync` fails (e.g., git not found, repository not initialized).
 * @see {@link https://git-scm.com/docs/git-ls-files}
 * @example
 * const files = await getSourceFilesToUpdate();
 * console.log(`Files needing update: ${files.length}`);
 * @since 1.0.0
 * @version 1.0.0
 */
const getSourceFilesToUpdate = async () => {
  const paths = (
    execSync('git ls-files', FILE_OPTS) +
    '\n' +
    execSync('git ls-files -o --exclude-standard', FILE_OPTS)
  )
    .split('\n')
    .filter((p) => !!p);

  const existingPaths = (
    await Promise.all(paths.map(async (path) => ((await fileExists(path)) ? path : null)))
  ).filter((path) => path !== null) as string[];

  const fileContents = await Promise.all(
    existingPaths.map((path) => readFile(path, { encoding: 'utf-8' })),
  );

  return fileContents
    .map((contents, idx) => ({
      contents,
      path: existingPaths[idx]!,
      format: FORMAT_TYPES.find(({ regex }) => regex.test(existingPaths[idx]!)),
    }))
    .filter(({ contents, format }) => format && !/Copyright \d\d\d\d/.test(contents));
};

/**
 * Prepends the standard copyright header to the given content based on the specified format type.
 * @param {string} content - The original content of the file.
 * @param {FormatType} format - The format type object containing header, body, and footer definitions.
 * @returns {string} The updated content with the copyright header.
 * @since 1.0.0
 * @version 1.0.0
 * @example
 * const newContent = updateContent('console.log("Hello");', FORMAT_TYPES[0]);
 * // newContent will have the JS/TS copyright header prepended.
 */
const updateContent = (content: string, format: FormatType): string => {
  const header = format.header ? `${format.header}\n` : '';
  const body = COPYRIGHT.split('\n')
    .map((l) => format.body + l)
    .join('\n');
  const footer = format.footer ? `\n${format.footer}` : '';

  return `${header}${body}${footer}\n\n${content}`;
};

console.log('Checking copyright in sources...');

/**
 * Main execution block of the script.
 * This script checks for and optionally updates copyright headers in source files.
 * If run with `--check` argument, it only reports missing headers and exits with an error code if any are found.
 * Otherwise, it updates missing headers in place.
 * @file
 * @since 1.0.0
 * @version 1.0.0
 * @see {@link https://www.apache.org/licenses/LICENSE-2.0}
 * @async
 */
(async () => {
  const missing = await getSourceFilesToUpdate();
  if (process.argv[2] === '--check') {
    if (missing.length) {
      console.error(`Copyright header missing in ${missing.map(({ path }) => path).join(', ')}`);
      console.error('Run `npm run format` at root to update');
      process.exit(1);
    }
    console.log('Copyright headers okay');
    process.exit(0);
  }

  const updated = missing.map((m) => {
    m.contents = updateContent(m.contents, m.format!);
    return m;
  });

  await Promise.all(
    updated.map(({ path, contents }) => writeFile(path, contents, { encoding: 'utf-8' })),
  );
  console.log(`Updated copyright headers in ${updated.length} files`);
})();
