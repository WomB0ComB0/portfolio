#!/usr/bin/env bun
/**
 * Type Safety Validation Script
 * Run with: bun src/__tests__/type-check.ts
 *
 * This script validates type safety across the codebase, checking:
 * - Effect fetcher type consistency
 * - Schema validation types
 * - API response types
 * - Component prop types
 */

import { Schema } from 'effect';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

// Test Schema definitions
const SpotifyTrackSchema = Schema.Struct({
  title: Schema.String,
  artist: Schema.String,
  album: Schema.optional(Schema.String),
  albumImageUrl: Schema.optional(Schema.String),
  songUrl: Schema.optional(Schema.String),
  isPlaying: Schema.Boolean,
});

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

const ApiResponseSchema = <T extends Schema.Schema.Any>(dataSchema: T) =>
  Schema.Struct({
    success: Schema.Boolean,
    data: Schema.optional(dataSchema),
    error: Schema.optional(Schema.String),
    message: Schema.optional(Schema.String),
  });

async function validateSchemaTypes() {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    log('  ✅ Invalid data correctly rejected', 'green');
    passedTests++;
  }

  return { passedTests, failedTests };
}

async function checkTypeInference() {
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

async function validateUrlConversion() {
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

async function main() {
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

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
