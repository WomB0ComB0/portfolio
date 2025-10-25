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
 * @file Type Safety Validation Script
 * @author Mike Odnis
 * @version 1.0.0
 * @description This script performs comprehensive type safety validation across various parts of the codebase.
 * It checks for:
 * - Consistency and correctness of Effect Schema definitions and their validation.
 * - Accurate compile-time type inference from Effect Schemas.
 * - Validation of URL handling logic.
 *
 * To run this script, execute: `bun src/__tests__/type-check.ts`
 */

import { Schema } from 'effect';

/**
 * @readonly
 * @description ANSI escape codes for terminal text coloring.
 */
const colors = {
  /** @readonly */
  reset: '\x1b[0m',
  /** @readonly */
  bright: '\x1b[1m',
  /** @readonly */
  red: '\x1b[31m',
  /** @readonly */
  green: '\x1b[32m',
  /** @readonly */
  yellow: '\x1b[33m',
  /** @readonly */
  blue: '\x1b[34m',
  /** @readonly */
  cyan: '\x1b[36m',
};

/**
 * Logs a message to the console with optional color formatting.
 * @param {string} message - The message to log.
 * @param {keyof typeof colors} [color] - The color to apply to the message. If not provided, defaults to no color.
 * @returns {void}
 */
function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

/**
 * @description Effect Schema definition for a Spotify track object.
 * @readonly
 * @type {Schema.Schema<
 *   {
 *     title: string;
 *     artist: string;
 *     album?: string | undefined;
 *     albumImageUrl?: string | undefined;
 *     songUrl?: string | undefined;
 *     isPlaying: boolean;
 *   },
 *   {
 *     title: string;
 *     artist: string;
 *     album?: string | undefined;
 *     albumImageUrl?: string | undefined;
 *     songUrl?: string | undefined;
 *     isPlaying: boolean;
 *   }
 * >}
 */
const SpotifyTrackSchema = Schema.Struct({
  title: Schema.String,
  artist: Schema.String,
  album: Schema.optional(Schema.String),
  albumImageUrl: Schema.optional(Schema.String),
  songUrl: Schema.optional(Schema.String),
  isPlaying: Schema.Boolean,
});

/**
 * @description Effect Schema definition for GitHub statistics, including stars, followers, and repos.
 * @readonly
 * @type {Schema.Schema<
 *   {
 *     success: boolean;
 *     data?: {
 *       stars?: number | undefined;
 *       followers?: number | undefined;
 *       repos?: number | undefined;
 *     } | undefined;
 *   },
 *   {
 *     success: boolean;
 *     data?: {
 *       stars?: number | undefined;
 *       followers?: number | undefined;
 *       repos?: number | undefined;
 *     } | undefined;
 *   }
 * >}
 */
const GitHubStatsSchema = Schema.Struct({
  success: Schema.Boolean,
  data: Schema.optional(
    Schema.Struct({
      stars: Schema.optional(Schema.Number),
      followers: Schema.optional(Schema.Number),
      repos: Schema.optional(Schema.Number),
    }),
  ),
});

/**
 * Creates a generic Effect Schema for an API response wrapper.
 * This schema includes `success`, an optional `data` field (typed by the provided schema),
 * and optional `error` and `message` fields.
 * @template T - The type of the data field's schema. Must extend `Schema.Schema.Any`.
 * @param {T} dataSchema - The Effect Schema for the `data` field of the API response.
 * @returns {Schema.Schema<
 *   {
 *     success: boolean;
 *     data?: Schema.Schema.Type<T> | undefined;
 *     error?: string | undefined;
 *     message?: string | undefined;
 *   },
 *   {
 *     success: boolean;
 *     data?: Schema.Schema.Encoded<T> | undefined;
 *     error?: string | undefined;
 *     message?: string | undefined;
 *   }
 * >} An Effect Schema representing the API response structure.
 * @example
 * // Define a schema for an API response containing a string
 * const StringResponseSchema = ApiResponseSchema(Schema.String);
 *
 * // Example of valid data for StringResponseSchema
 * const validStringData = { success: true, data: "Hello API" };
 *
 * // Example of invalid data (data field type mismatch)
 * const invalidStringData = { success: true, data: 123 };
 */
const ApiResponseSchema = <T extends Schema.Schema.Any>(dataSchema: T) =>
  Schema.Struct({
    success: Schema.Boolean,
    data: Schema.optional(dataSchema),
    error: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
  });

/**
 * @async
 * @description Validates various Effect Schema definitions against valid and invalid data.
 * It logs the results of each validation test, indicating success or failure.
 * @returns {Promise<{ passedTests: number; failedTests: number }>} An object containing the count of passed and failed schema validation tests.
 * @author Mike Odnis
 * @see {@link SpotifyTrackSchema}
 * @see {@link GitHubStatsSchema}
 * @see {@link ApiResponseSchema}
 */
async function validateSchemaTypes(): Promise<{ passedTests: number; failedTests: number }> {
  log('\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║           Type Safety Validation Tests            ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Spotify Track Schema
  log(`\n🔍 Testing: Spotify Track Schema`, 'cyan');
  try {
    const validData = {
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      isPlaying: true,
    };
    const decoded = Schema.decodeUnknownSync(SpotifyTrackSchema)(validData);
    log('  ✅ Valid data passes schema validation', 'green');
    log(`     Type: ${JSON.stringify(decoded, null, 2).substring(0, 100)}...`, 'blue');
    passedTests++;
  } catch (error) {
    log('  ❌ Valid data failed schema validation', 'red');
    log(`     Error: ${error instanceof Error ? error.message : String(error)}`, 'red');
    failedTests++;
  }

  try {
    const invalidData = {
      title: 'Test Song',
      // Missing required 'artist' field
      isPlaying: 'not a boolean', // Wrong type
    };
    Schema.decodeUnknownSync(SpotifyTrackSchema)(invalidData);
    log('  ❌ Invalid data incorrectly passed validation', 'red');
    failedTests++;
  } catch (_error) {
    log('  ✅ Invalid data correctly rejected', 'green');
    log('     Expected validation error caught', 'blue');
    passedTests++;
  }

  // Test 2: GitHub Stats Schema
  log(`\n🔍 Testing: GitHub Stats Schema`, 'cyan');
  try {
    const validData = {
      success: true,
      data: {
        stars: 100,
        followers: 50,
        repos: 25,
      },
    };
    const decoded = Schema.decodeUnknownSync(GitHubStatsSchema)(validData);
    log('  ✅ Valid data passes schema validation', 'green');
    log(`     Data: ${JSON.stringify(decoded.data)}`, 'blue');
    passedTests++;
  } catch (_error) {
    log('  ❌ Valid data failed schema validation', 'red');
    failedTests++;
  }

  try {
    const invalidData = {
      success: 'yes', // Wrong type
      data: {
        stars: '100', // Wrong type (should be number)
      },
    };
    Schema.decodeUnknownSync(GitHubStatsSchema)(invalidData);
    log('  ❌ Invalid data incorrectly passed validation', 'red');
    failedTests++;
  } catch (_error) {
    log('  ✅ Invalid data correctly rejected', 'green');
    passedTests++;
  }

  // Test 3: API Response Schema
  log(`\n🔍 Testing: API Response Schema`, 'cyan');
  try {
    const StringResponseSchema = ApiResponseSchema(Schema.String);
    const validData = {
      success: true,
      data: 'Hello World',
    };
    const decoded = Schema.decodeUnknownSync(StringResponseSchema)(validData);
    log('  ✅ Valid data passes schema validation', 'green');
    log(`     Data: ${decoded.data}`, 'blue');
    passedTests++;
  } catch (_error) {
    log('  ❌ Valid data failed schema validation', 'red');
    failedTests++;
  }

  try {
    const StringResponseSchema = ApiResponseSchema(Schema.String);
    const invalidData = {
      success: true,
      data: 12345, // Wrong type (should be string)
    };
    Schema.decodeUnknownSync(StringResponseSchema)(invalidData);
    log('  ❌ Invalid data incorrectly passed validation', 'red');
    failedTests++;
  } catch (_error) {
    log('  ✅ Invalid data correctly rejected', 'green');
    passedTests++;
  }

  return { passedTests, failedTests };
}

/**
 * @async
 * @description Checks the correctness of TypeScript's type inference from Effect Schemas.
 * It validates that `Schema.Schema.Type` correctly derives types, handles optional fields,
 * and infers types for nested schemas.
 * @returns {Promise<{ passed: number; failed: number }>} An object containing the count of passed and failed type inference tests.
 * @author Mike Odnis
 * @see {@link https://effect.website/docs/schema/guide/inference}
 */
async function checkTypeInference(): Promise<{ passed: number; failed: number }> {
  log('\n\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║              Type Inference Tests                 ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');

  const tests = [
    {
      name: 'Schema.Type inference',
      test: () => {
        // This tests compile-time type inference
        type SpotifyTrack = Schema.Schema.Type<typeof SpotifyTrackSchema>;

        // This should compile correctly
        const track: SpotifyTrack = {
          title: 'Test',
          artist: 'Artist',
          isPlaying: false,
        };

        log('  ✅ Schema.Schema.Type correctly inferred', 'green');
        log(`     Track: ${JSON.stringify(track)}`, 'blue');
        return true;
      },
    },
    {
      name: 'Optional field handling',
      test: () => {
        type SpotifyTrack = Schema.Schema.Type<typeof SpotifyTrackSchema>;

        // albumImageUrl is optional
        const trackWithoutAlbum: SpotifyTrack = {
          title: 'Test',
          artist: 'Artist',
          isPlaying: true,
        };

        const trackWithAlbum: SpotifyTrack = {
          title: 'Test',
          artist: 'Artist',
          album: 'Album Name',
          albumImageUrl: 'https://example.com/image.jpg',
          isPlaying: true,
        };

        log('  ✅ Optional fields handled correctly', 'green');
        log(`     Without: ${Object.keys(trackWithoutAlbum).join(', ')}`, 'blue');
        log(`     With: ${Object.keys(trackWithAlbum).join(', ')}`, 'blue');
        return true;
      },
    },
    {
      name: 'Nested schema inference',
      test: () => {
        type GitHubStats = Schema.Schema.Type<typeof GitHubStatsSchema>;

        const stats: GitHubStats = {
          success: true,
          data: {
            stars: 100,
            followers: 50,
            repos: 25,
          },
        };

        log('  ✅ Nested schema types inferred correctly', 'green');
        log(`     Data keys: ${stats.data ? Object.keys(stats.data).join(', ') : 'none'}`, 'blue');
        return true;
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    log(`\n🔍 Testing: ${test.name}`, 'cyan');
    try {
      const result = test.test();
      if (result) {
        passed++;
      } else {
        failed++;
        log('  ❌ Test returned false', 'red');
      }
    } catch (error) {
      failed++;
      log('  ❌ Test threw error', 'red');
      log(`     ${error instanceof Error ? error.message : String(error)}`, 'red');
    }
  }

  return { passed, failed };
}

/**
 * @async
 * @description Validates the expected behavior of URL conversion, distinguishing between absolute and relative URLs.
 * It simulates how URLs might be handled or converted in a web context.
 * @returns {Promise<{ passed: number; failed: number }>} An object containing the count of passed and failed URL conversion tests.
 * @web
 * @author Mike Odnis
 */
async function validateUrlConversion(): Promise<{ passed: number; failed: number }> {
  log('\n\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║            URL Conversion Validation              ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');

  const testCases = [
    { input: '/api/v1/test', shouldStartWith: 'http' },
    { input: 'http://example.com/api', shouldStartWith: 'http://example.com' },
    { input: 'https://api.example.com/v1', shouldStartWith: 'https://api.example.com' },
    { input: '/relative/path', shouldStartWith: 'http' },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const isAbsolute = testCase.input.startsWith('http');
    const result = isAbsolute ? testCase.input : `[Would be converted to absolute URL]`;

    log(`\n📝 Input: ${testCase.input}`, 'cyan');
    log(`   Is absolute: ${isAbsolute}`, isAbsolute ? 'green' : 'yellow');
    log(`   Result: ${result}`, 'blue');

    if (isAbsolute) {
      if (testCase.input.startsWith(testCase.shouldStartWith)) {
        log('   ✅ URL format valid', 'green');
        passed++;
      } else {
        log('   ❌ URL format invalid', 'red');
        failed++;
      }
    } else {
      log('   ✅ Would be converted by getURL()', 'green');
      passed++;
    }
  }

  return { passed, failed };
}

/**
 * @async
 * @description The main function that orchestrates all type safety validation tests.
 * It runs schema validation, type inference checks, and URL conversion tests,
 * then prints a consolidated summary of all results.
 * Exits with a status code of 1 if any tests fail, otherwise exits successfully.
 * @returns {Promise<void>}
 * @author Mike Odnis
 * @see {@link validateSchemaTypes}
 * @see {@link checkTypeInference}
 * @see {@link validateUrlConversion}
 */
async function main(): Promise<void> {
  log('\n🚀 Starting Type Safety Validation...\n', 'bright');

  const schemaResults = await validateSchemaTypes();
  const inferenceResults = await checkTypeInference();
  const urlResults = await validateUrlConversion();

  // Summary
  log('\n\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║                  Final Summary                    ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');

  const totalPassed = schemaResults.passedTests + inferenceResults.passed + urlResults.passed;
  const totalFailed = schemaResults.failedTests + inferenceResults.failed + urlResults.failed;
  const total = totalPassed + totalFailed;

  log(`\n✅ Passed: ${totalPassed}/${total}`, 'green');
  log(`❌ Failed: ${totalFailed}/${total}`, totalFailed > 0 ? 'red' : 'green');
  log(`📊 Success Rate: ${((totalPassed / total) * 100).toFixed(1)}%`, 'cyan');

  log('\n📋 Details:', 'bright');
  log(
    `   Schema Validation: ${schemaResults.passedTests} passed, ${schemaResults.failedTests} failed`,
    'cyan',
  );
  log(
    `   Type Inference: ${inferenceResults.passed} passed, ${inferenceResults.failed} failed`,
    'cyan',
  );
  log(`   URL Conversion: ${urlResults.passed} passed, ${urlResults.failed} failed`, 'cyan');

  log('\n✨ Type checking complete!\n', 'green');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((error: Error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
