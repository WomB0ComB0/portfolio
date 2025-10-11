#!/usr/bin/env bun

/**
 * Copyright 2025 Product Decoder
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

import { GoogleGenAI } from '@google/genai';
import { execSync } from 'node:child_process';
import { readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

/**
 * @interface GenerationConfig
 * @description Configuration options for the AI text generation model.
 */
interface GenerationConfig {
  /**
   * @property {string} model - The name of the AI model to use (e.g., 'gemini-2.5-flash-preview-05-20').
   */
  model: string;
  /**
   * @property {number} maxOutputTokens - The maximum number of tokens the model should generate in its output.
   */
  maxOutputTokens: number;
  /**
   * @property {number} [temperature] - Controls the randomness of the output. Lower values (e.g., 0.1) make the output more deterministic and focused. Higher values (e.g., 1.0) make the output more varied.
   */
  temperature?: number;
  /**
   * @property {number} [maxConcurrency] - Maximum number of concurrent API requests to make. Defaults to 3.
   */
  maxConcurrency?: number;
  /**
   * @property {number} [retryAttempts] - Number of retry attempts for failed API calls. Defaults to 2.
   */
  retryAttempts?: number;
  /**
   * @property {number} [retryDelay] - Delay between retry attempts in milliseconds. Defaults to 1000.
   */
  retryDelay?: number;
}

/**
 * @interface ProcessingResult
 * @description Result of processing a single file.
 */
interface ProcessingResult {
  /**
   * @property {string} filePath - The path of the processed file.
   */
  filePath: string;
  /**
   * @property {boolean} success - Whether the processing was successful.
   */
  success: boolean;
  /**
   * @property {string} [error] - Error message if processing failed.
   */
  error?: string;
  /**
   * @property {number} [duration] - Processing time in milliseconds.
   */
  duration?: number;
}

/**
 * @class ConcurrencyLimiter
 * @description A utility class to limit the number of concurrent asynchronous operations.
 */
class ConcurrencyLimiter {
  /**
   * @private
   * @readonly
   * @type {number}
   * @description Maximum number of concurrent operations allowed.
   */
  private readonly maxConcurrency: number;

  /**
   * @private
   * @type {number}
   * @description Current number of running operations.
   */
  private running = 0;

  /**
   * @private
   * @type {Array<() => void>}
   * @description Queue of pending operations waiting to be executed.
   */
  private queue: Array<() => void> = [];

  /**
   * @constructor
   * @description Creates an instance of ConcurrencyLimiter.
   * @param {number} maxConcurrency - Maximum number of concurrent operations.
   */
  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * @async
   * @description Executes a function with concurrency control.
   * @template T
   * @param {() => Promise<T>} fn - The asynchronous function to execute.
   * @returns {Promise<T>} A promise that resolves with the function's result.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrency) {
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  /**
   * @private
   * @description Processes the next item in the queue if capacity is available.
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }
}

/**
 * @class JSDocGenerator
 * @description A class for generating JSDoc comments for code files using a Google GenAI model with concurrency control and retry logic.
 * @author Your Name
 * @since 1.0.0
 * @version 2.0.0
 * @see {@link https://ai.google.dev/docs/gemini_api_overview|Google Gemini API}
 */
class JSDocGenerator {
  /**
   * @private
   * @readonly
   * @type {GoogleGenAI}
   * @description The Google GenAI client instance.
   */
  private readonly ai: GoogleGenAI;

  /**
   * @private
   * @readonly
   * @type {GenerationConfig}
   * @description The configuration settings for the AI generation.
   */
  private readonly config: GenerationConfig;

  /**
   * @private
   * @readonly
   * @type {ConcurrencyLimiter}
   * @description The concurrency limiter for controlling API requests.
   */
  private readonly concurrencyLimiter: ConcurrencyLimiter;

  /**
   * @constructor
   * @description Creates an instance of JSDocGenerator.
   * @param {string} apiKey - Your Google Gemini API key.
   * @param {Partial<GenerationConfig>} [config={}] - Optional partial configuration to override default AI model settings.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY', {
   *   temperature: 0.2,
   *   maxConcurrency: 5,
   *   retryAttempts: 3
   * });
   * ```
   */
  constructor(apiKey: string, config: Partial<GenerationConfig> = {}) {
    this.ai = new GoogleGenAI({ apiKey });
    this.config = {
      model: 'gemini-2.5-flash-preview-05-20',
      maxOutputTokens: 65536,
      temperature: 0.1,
      maxConcurrency: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      ...config,
    };
    this.concurrencyLimiter = new ConcurrencyLimiter(this.config.maxConcurrency!);
  }

  /**
   * @async
   * @private
   * @description Delays execution for a specified number of milliseconds.
   * @param {number} ms - The number of milliseconds to delay.
   * @returns {Promise<void>} A promise that resolves after the delay.
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @async
   * @private
   * @description Makes an API call with retry logic.
   * @param {string} fileContent - The content of the file to process.
   * @param {number} [attempt=1] - Current attempt number.
   * @returns {Promise<string>} A promise that resolves with the generated content.
   * @throws {Error} If all retry attempts fail.
   */
  private async makeApiCall(fileContent: string, attempt = 1): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: [
          {
            parts: [
              {
                text: fileContent,
              },
            ],
          },
        ],
        config: {
          systemInstruction: `You are a technical documentation expert. Given the provided code, generate comprehensive JSDoc comments that include:
          
          1. Function/method descriptions with clear explanations
          2. @param tags with types and descriptions
          3. @returns tags with types and descriptions
          4. @throws tags for potential errors
          5. @example tags where helpful
          6. Class and interface documentation
          7. @deprecated tags where applicable
          8. @web tags for web-related APIs or methods
          9. @author tags
          10. @see tags for related documentation or references
          11. @since tags to indicate when a feature was added
          12. @version tags for versioning information
          13. @async tags for asynchronous functions
          14. @readonly tags for read-only properties
          15. @private, @protected, @public for access control
          
          Rules:
          - Only return the code with JSDoc comments added
          - Do not include any explanatory text, metadata, or markdown
          - Preserve the original code structure exactly
          - Use proper TypeScript types in JSDoc annotations
          - Do not use jsdoc comments in unnecessary places, mainly for blocks of code which references subsequent and sometimes overarching codeblocks
          - Be concise but comprehensive
          - Refrain from wrapping the files with markdown codeblock syntax (i.e \`\`\`<language> <content>\`\`\`)`,
          maxOutputTokens: this.config.maxOutputTokens,
          temperature: this.config.temperature,
        },
      });

      const generatedContent = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedContent) {
        throw new Error('No content generated from AI response');
      }

      return generatedContent;
    } catch (error) {
      if (attempt < this.config.retryAttempts! + 1) {
        console.warn(`🔄 Attempt ${attempt} failed, retrying in ${this.config.retryDelay}ms...`);
        await this.delay(this.config.retryDelay!);
        return this.makeApiCall(fileContent, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * @async
   * @description Generates JSDoc comments for the content of a given file using the configured AI model.
   * @param {string} filePath - The absolute or relative path to the source code file.
   * @returns {Promise<string>} A promise that resolves with the generated JSDoc-commented code as a string.
   * @throws {Error} If the file is empty or if the AI model fails to generate content.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * const documentedCode = await generator.generateJSDoc('./src/myFile.ts');
   * console.log(documentedCode);
   * ```
   */
  async generateJSDoc(filePath: string): Promise<string> {
    const fileContent = await Bun.file(filePath).text();

    if (!fileContent.trim()) {
      throw new Error(`File ${filePath} is empty`);
    }

    return this.concurrencyLimiter.execute(() => this.makeApiCall(fileContent));
  }

  /**
   * @async
   * @description Processes a single file by generating JSDoc comments and optionally saving the result to a new file or overwriting the original.
   * @param {string} inputPath - The path to the input source code file.
   * @param {string} [outputPath] - Optional path where the documented file should be saved. If not provided and `overwrite` is false, a `.documented` suffix will be added to the input file name.
   * @param {boolean} [overwrite=false] - If `true`, the original `inputPath` file will be overwritten with the generated content. If `false`, a new file will be created.
   * @returns {Promise<ProcessingResult>} A promise that resolves with the processing result.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * const result = await generator.processFile('./src/myFile.ts', './dist/myFile.documented.ts');
   * console.log(`Success: ${result.success}, Duration: ${result.duration}ms`);
   * ```
   */
  async processFile(
    inputPath: string,
    outputPath?: string,
    overwrite = false,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Processing ${inputPath}...`);

      const generatedContent = await this.generateJSDoc(inputPath);

      if (overwrite) {
        await writeFile(inputPath, generatedContent);
        console.log(`✅ Updated ${inputPath}`);
      } else {
        const finalOutputPath = outputPath || this.getOutputPath(inputPath);
        await writeFile(finalOutputPath, generatedContent);
        console.log(`✅ Generated ${finalOutputPath}`);
      }

      const duration = Date.now() - startTime;
      return {
        filePath: inputPath,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process ${inputPath}: ${errorMessage}`);

      return {
        filePath: inputPath,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * @private
   * @description Generates a default output file path by appending `.documented` before the file extension.
   * @param {string} inputPath - The original input file path.
   * @returns {string} The generated output path (e.g., `file.ts` becomes `file.documented.ts`).
   * @example
   * ```typescript
   * // Inside the class
   * const outputPath = this.getOutputPath('/path/to/myFile.ts'); // Returns '/path/to/myFile.documented.ts'
   * ```
   */
  private getOutputPath(inputPath: string): string {
    const ext = extname(inputPath);
    const base = basename(inputPath, ext);
    const dir = inputPath.replace(basename(inputPath), '');
    return join(dir, `${base}.documented${ext}`);
  }

  /**
   * @async
   * @description Processes an array of files with concurrency control, generating JSDoc comments for each.
   * @param {string[]} filePaths - An array of paths to the source code files to process.
   * @param {boolean} [overwrite=false] - If `true`, each original file will be overwritten with its documented version. If `false`, new `.documented` files will be created.
   * @returns {Promise<ProcessingResult[]>} A promise that resolves with an array of processing results for each file.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * const results = await generator.processFiles(['./src/file1.ts', './src/file2.js'], true);
   * console.log(`Processed ${results.filter(r => r.success).length} files successfully`);
   * ```
   */
  async processFiles(filePaths: string[], overwrite = false): Promise<ProcessingResult[]> {
    const startTime = Date.now();
    console.log(
      `🚀 Starting processing of ${filePaths.length} files with max concurrency: ${this.config.maxConcurrency}`,
    );

    const results = await Promise.all(
      filePaths.map((filePath) => this.processFile(filePath, undefined, overwrite)),
    );

    const totalDuration = Date.now() - startTime;
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log('\n📊 Processing Summary:');
    console.log(`✅ Successful: ${successful.length}/${results.length} files`);
    console.log(`❌ Failed: ${failed.length}/${results.length} files`);
    console.log(`⏱️  Total time: ${totalDuration}ms`);
    console.log(`⚡ Average time per file: ${Math.round(totalDuration / results.length)}ms`);

    if (failed.length > 0) {
      console.log('\n❌ Failed files:');
      failed.forEach((result) => {
        console.log(`  - ${result.filePath}: ${result.error}`);
      });
    }

    return results;
  }

  /**
   * @async
   * @description Scans for supported JavaScript/TypeScript files using Git to respect .gitignore rules.
   * @param {string} [directoryPath='.'] - The path to the directory to scan (defaults to current directory).
   * @param {boolean} [includeUntracked=true] - If `true`, includes untracked files that aren't ignored by Git.
   * @param {string[]} [additionalExcludePatterns=[]] - Additional patterns to exclude beyond Git's ignore rules.
   * @returns {Promise<string[]>} A promise that resolves with an array of file paths found using Git.
   * @throws {Error} If not in a Git repository or Git command fails.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * const files = await generator.scanGitFiles('./src', true, ['*.test.ts']);
   * console.log(`Found ${files.length} files to process`);
   * ```
   */
  async scanGitFiles(
    directoryPath = '.',
    includeUntracked = true,
    additionalExcludePatterns: string[] = [],
  ): Promise<string[]> {
    const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx'];
    const FILE_OPTS = { encoding: 'utf8' as const, cwd: directoryPath };

    try {
      // Get tracked files and optionally untracked files (respecting .gitignore)
      let gitOutput = execSync('git ls-files', FILE_OPTS) as string;

      if (includeUntracked) {
        const untrackedOutput = execSync('git ls-files -o --exclude-standard', FILE_OPTS) as string;
        gitOutput += '\n' + untrackedOutput;
      }

      // Parse the output into file paths
      const allFiles = gitOutput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((file) => (directoryPath === '.' ? file : join(directoryPath, file)));

      // Filter by supported extensions
      const supportedFiles = allFiles.filter((file) => {
        const ext = extname(file);
        return supportedExtensions.includes(ext);
      });

      // Apply additional exclusion patterns if provided
      const filteredFiles =
        additionalExcludePatterns.length > 0
          ? supportedFiles.filter((file) => {
              return !additionalExcludePatterns.some((pattern) => {
                if (pattern.includes('*')) {
                  const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
                  return regex.test(file);
                }
                return file.includes(pattern);
              });
            })
          : supportedFiles;

      console.log(
        `📁 Found ${filteredFiles.length} supported files using Git${includeUntracked ? ' (including untracked)' : ''}`,
      );

      return filteredFiles;
    } catch (error) {
      // Fallback to directory scanning if not in a Git repo
      console.warn(
        '⚠️  Git not available or not in a Git repository, falling back to directory scanning',
      );
      return this.scanDirectory(directoryPath, true, additionalExcludePatterns);
    }
  }

  /**
   * @async
   * @description Scans a directory for supported JavaScript/TypeScript files and returns their paths.
   * @param {string} directoryPath - The path to the directory to scan.
   * @param {boolean} [recursive=false] - If `true`, scans subdirectories recursively.
   * @param {string[]} [excludePatterns=[]] - Array of glob patterns to exclude from scanning (e.g., ['node_modules', '*.test.ts']).
   * @returns {Promise<string[]>} A promise that resolves with an array of file paths found in the directory.
   * @throws {Error} If the directory doesn't exist or cannot be read.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * const files = await generator.scanDirectory('./src', true, ['*.test.ts', 'node_modules']);
   * console.log(`Found ${files.length} files to process`);
   * ```
   */
  async scanDirectory(
    directoryPath: string,
    recursive = false,
    excludePatterns: string[] = [],
  ): Promise<string[]> {
    const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx'];
    const defaultExcludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '*.test.*',
      '*.spec.*',
    ];
    const allExcludePatterns = [...defaultExcludePatterns, ...excludePatterns];

    const shouldExclude = (filePath: string): boolean => {
      return allExcludePatterns.some((pattern) => {
        // Simple glob pattern matching
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
          return regex.test(filePath);
        }
        return filePath.includes(pattern);
      });
    };

    const scanDir = async (dir: string): Promise<string[]> => {
      const files: string[] = [];

      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (shouldExclude(fullPath)) {
            continue;
          }

          if (entry.isDirectory() && recursive) {
            const subFiles = await scanDir(fullPath);
            files.push(...subFiles);
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            if (supportedExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        throw new Error(
          `Failed to scan directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return files;
    };

    const files = await scanDir(directoryPath);
    console.log(
      `📁 Found ${files.length} supported files in ${directoryPath}${recursive ? ' (recursive)' : ''}`,
    );

    return files;
  }

  /**
   * @async
   * @description Processes all supported files in a directory with JSDoc generation, using Git for file discovery when available.
   * @param {string} directoryPath - The path to the directory containing files to process.
   * @param {boolean} [useGit=true] - If `true`, uses Git to discover files (respects .gitignore). Falls back to directory scanning if not in a Git repo.
   * @param {boolean} [includeUntracked=true] - If `true` and using Git, includes untracked files that aren't ignored.
   * @param {boolean} [overwrite=false] - If `true`, overwrites original files with documented versions.
   * @param {string[]} [excludePatterns=[]] - Array of additional patterns to exclude from processing.
   * @returns {Promise<ProcessingResult[]>} A promise that resolves with processing results for all files.
   * @example
   * ```typescript
   * const generator = new JSDocGenerator('YOUR_API_KEY');
   * // Use Git to discover files (recommended)
   * const results = await generator.processDirectory('./src', true, true, false, ['*.test.ts']);
   *
   * // Fall back to directory scanning
   * const results2 = await generator.processDirectory('./src', false, false, false, ['*.test.ts']);
   * ```
   */
  async processDirectory(
    directoryPath: string,
    useGit = true,
    includeUntracked = true,
    overwrite = false,
    excludePatterns: string[] = [],
  ): Promise<ProcessingResult[]> {
    let files: string[] = [];

    if (useGit) {
      try {
        files = await this.scanGitFiles(directoryPath, includeUntracked, excludePatterns);
      } catch (error) {
        console.warn('⚠️  Git scanning failed, falling back to directory scanning');
        files = await this.scanDirectory(directoryPath, true, excludePatterns);
      }
    } else {
      files = await this.scanDirectory(directoryPath, true, excludePatterns);
    }

    if (files.length === 0) {
      console.log(`📁 No supported files found in ${directoryPath}`);
      return [];
    }

    return this.processFiles(files, overwrite);
  }

  /**
   * @description Gets the current configuration of the JSDoc generator.
   * @returns {GenerationConfig} The current configuration object.
   */
  getConfig(): GenerationConfig {
    return { ...this.config };
  }

  /**
   * @description Updates the configuration of the JSDoc generator.
   * @param {Partial<GenerationConfig>} newConfig - Partial configuration to merge with existing config.
   * @throws {Error} If trying to update maxConcurrency after initialization.
   * @example
   * ```typescript
   * generator.updateConfig({ temperature: 0.3, retryAttempts: 5 });
   * ```
   */
  updateConfig(newConfig: Partial<GenerationConfig>): void {
    if (newConfig.maxConcurrency && newConfig.maxConcurrency !== this.config.maxConcurrency) {
      throw new Error(
        'Cannot update maxConcurrency after initialization. Create a new instance instead.',
      );
    }
    Object.assign(this.config, newConfig);
  }
}

/**
 * @async
 * @description Displays the help message with usage instructions and examples.
 * @returns {Promise<void>} A promise that resolves when the help message is displayed.
 */
async function showHelp(): Promise<void> {
  console.log(`
📚 JSDoc Generator - AI-powered JSDoc comment generation

USAGE:
  bun jsdoc-generator.ts [OPTIONS] [FILES...]

OPTIONS:
  --help                    Show this help message
  --dir <path>             Process all files in directory (default: current directory)
  --no-git                 Disable Git file discovery, use directory scanning instead
  --no-untracked          Exclude untracked files when using Git discovery
  --overwrite              Overwrite original files instead of creating .documented versions
  --concurrency <n>        Maximum concurrent API requests (default: 3)
  --retry-attempts <n>     Number of retry attempts for failed requests (default: 2)
  --exclude <pattern>      Exclude files matching pattern (can be used multiple times)

EXAMPLES:
  # Process specific files
  bun jsdoc-generator.ts file1.ts file2.js --overwrite

  # Process all Git-tracked files in current directory (respects .gitignore)
  bun jsdoc-generator.ts --dir .

  # Process all files in src directory using Git (recommended)
  bun jsdoc-generator.ts --dir ./src

  # Process using directory scanning instead of Git
  bun jsdoc-generator.ts --dir ./src --no-git

  # Process Git-tracked files only (exclude untracked files)
  bun jsdoc-generator.ts --dir ./src --no-untracked

  # Process with custom settings and exclusions
  bun jsdoc-generator.ts --dir ./src --concurrency 5 --exclude "*.test.ts" --exclude "*.spec.js"

  # Overwrite original files
  bun jsdoc-generator.ts --dir . --overwrite

SUPPORTED FILE TYPES:
  .ts, .js, .tsx, .jsx

ENVIRONMENT VARIABLES:
  GEMINI_API_KEY          Your Google Gemini API key (required)

FILE DISCOVERY:
  By default, uses 'git ls-files' to discover files, which:
  - Respects your .gitignore rules
  - Includes tracked files
  - Optionally includes untracked files (not ignored by Git)
  - Falls back to directory scanning if not in a Git repository

FALLBACK EXCLUSIONS (when not using Git):
  node_modules, .git, dist, build, coverage, *.test.*, *.spec.*
`);
}

/**
 * @async
 * @description The main entry point for the command-line interface (CLI) of the JSDoc generator.
 * It parses command-line arguments, validates input files, and orchestrates the JSDoc generation process.
 * @returns {Promise<void>} A promise that resolves when the CLI operation completes or rejects if an unhandled error occurs.
 * @throws {Error} If the `GEMINI_API_KEY` environment variable is not set, no valid files are provided, or processing fails.
 * @example
 * ```bash
 * # Process specific files
 * bun jsdoc-generator.ts ./src/myFile.ts ./src/anotherFile.js --overwrite --concurrency 5
 *
 * # Process all files in current directory
 * bun jsdoc-generator.ts --dir .
 *
 * # Process directory recursively with exclusions
 * bun jsdoc-generator.ts --dir ./src --recursive --exclude "*.test.ts"
 * ```
 * @see {@link JSDocGenerator}
 */
async function main() {
  const args = Bun.argv as [string, ...string[]];

  if (args.includes('--help') || args.includes('-h')) {
    await showHelp();
    return;
  }

  const apiKey = Bun.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse command line arguments
  const overwrite = args.includes('--overwrite');
  const useGit = !args.includes('--no-git');
  const includeUntracked = !args.includes('--no-untracked');

  const concurrencyIndex = args.indexOf('--concurrency');
  const retryIndex = args.indexOf('--retry-attempts');
  const dirIndex = args.indexOf('--dir');

  let maxConcurrency = 3;
  let retryAttempts = 2;
  let targetDirectory: string | null = null;

  if (concurrencyIndex !== -1 && concurrencyIndex < args.length - 1) {
    maxConcurrency = Number.parseInt(
      args[concurrencyIndex + 1] ?? '3',
      10
    );
    if (isNaN(maxConcurrency) || maxConcurrency < 1) {
      console.error('❌ Invalid concurrency value. Must be a positive integer.');
      process.exit(1);
    }
  }

  if (retryIndex !== -1 && retryIndex < args.length - 1) {
    retryAttempts = Number.parseInt(
      args[retryIndex + 1] ?? '2', 
      10
    );
    if (isNaN(retryAttempts) || retryAttempts < 0) {
      console.error('❌ Invalid retry attempts value. Must be a non-negative integer.');
      process.exit(1);
    }
  }

  if (dirIndex !== -1 && dirIndex < args.length - 1) {
    targetDirectory = args[dirIndex + 1] ?? null;
  }

  // Collect exclude patterns
  const excludePatterns: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--exclude' && i < args.length - 1) {
      excludePatterns.push(args[i + 1] ?? '');
    }
  }

  // Extract files by filtering out flags and their values
  const flagsToSkip = new Set([
    '--overwrite',
    '--no-git',
    '--no-untracked',
    '--concurrency',
    '--retry-attempts',
    '--dir',
    '--exclude',
  ]);
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    if (flagsToSkip.has(arg)) {
      // Skip the flag
      if (
        arg === '--concurrency' ||
        arg === '--retry-attempts' ||
        arg === '--dir' ||
        arg === '--exclude'
      ) {
        // Also skip the next argument (the value)
        i++;
      }
      continue;
    }

    // If it's not a flag, it's a file
    files.push(arg);
  }

  const generator = new JSDocGenerator(apiKey, {
    maxConcurrency,
    retryAttempts,
  });

  try {
    let results: ProcessingResult[] = [];

    if (targetDirectory) {
      // Process directory
      results = await generator.processDirectory(
        targetDirectory,
        useGit,
        includeUntracked,
        overwrite,
        excludePatterns,
      );
    } else if (files.length === 0) {
      // Default to current directory if no files specified
      results = await generator.processDirectory(
        '.',
        useGit,
        includeUntracked,
        overwrite,
        excludePatterns,
      );
    } else {
      // Process specific files
      const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx'];
      const validFiles = [];

      for (const file of files) {
        const fileExists = await Bun.file(file).exists();
        if (!fileExists) {
          console.error(`❌ File not found: ${file}`);
          continue;
        }

        const ext = extname(file);
        if (!supportedExtensions.includes(ext)) {
          console.error(`❌ Unsupported file type: ${file} (${ext})`);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        console.error('❌ No valid files to process');
        process.exit(1);
      }

      results = await generator.processFiles(validFiles, overwrite);
    }

    const failedCount = results.filter((r) => !r.success).length;

    if (failedCount > 0) {
      console.error(`\n❌ ${failedCount} files failed to process`);
      process.exit(1);
    }

    console.log('\n🎉 All files processed successfully!');
  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { JSDocGenerator, type GenerationConfig, type ProcessingResult };
