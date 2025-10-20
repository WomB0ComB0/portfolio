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
 * Manual API Testing Script
 * Run with: bun src/__tests__/api-manual-test.ts
 *
 * This script tests all API endpoints and logs detailed results to the console.
 * Use this for quick manual testing during development.
 * @version 1.0.0
 * @author Mike Odnis
 * @see {@link https://bun.sh/docs/runtime/exec#env-variables Bun Env Variables}
 */

/**
 * The base URL for the API endpoints to be tested.
 * Defaults to 'http://localhost:3000' if `NEXT_PUBLIC_SITE_URL` environment variable is not set.
 * @type {string}
 * @readonly
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Represents the detailed result of an API endpoint test.
 * @interface TestResult
 * @property {string} endpoint - The path of the API endpoint tested (e.g., '/api/v1/now-playing').
 * @property {'GET' | 'POST'} method - The HTTP method used for the request (e.g., 'GET', 'POST').
 * @property {number} status - The HTTP status code of the response (e.g., 200, 404).
 * @property {string} statusText - The HTTP status text of the response (e.g., 'OK', 'Not Found').
 * @property {boolean} success - Indicates whether the request was successful (HTTP status 2xx).
 * @property {number} responseTime - The time taken for the request to complete in milliseconds.
 * @property {unknown} [data] - The parsed response body. Can be JSON object or raw text.
 * @property {string} [error] - An error message if the request failed at the network level or encountered an exception.
 * @property {Record<string, string>} [headers] - A dictionary of response headers.
 * @author Mike Odnis
 * @version 1.0.0
 */
interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  success: boolean;
  responseTime: number;
  data?: unknown;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Defines ANSI escape codes for console text colors.
 * Used for stylized output in the console.
 * @readonly
 * @type {Readonly<Record<string, string>>}
 * @author Mike Odnis
 * @version 1.0.0
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Logs a message to the console with optional ANSI color styling.
 * @public
 * @param {string} message - The message string to log.
 * @param {keyof typeof colors} [color] - The name of the color to apply to the message (e.g., 'red', 'green').
 * @returns {void}
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * log("This is a success message", "green");
 * log("This is a plain message");
 */
function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

/**
 * Tests a single API endpoint by making an HTTP request.
 * It measures response time, parses the response, and captures status and any errors.
 * @public
 * @async
 * @web
 * @param {string} endpoint - The path of the API endpoint to test (e.g., '/api/v1/now-playing').
 * @param {'GET' | 'POST'} [method='GET'] - The HTTP method to use for the request.
 * @param {unknown} [body] - The request body for 'POST' requests. Will be JSON stringified.
 * @returns {Promise<TestResult>} A promise that resolves to a {@link TestResult} object containing the test details.
 * @throws {Error} If a network error occurs that prevents the `fetch` call from completing.
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * // Test a GET endpoint
 * const resultGet = await testEndpoint('/api/v1/github-stats');
 * printResult(resultGet);
 *
 * @example
 * // Test a POST endpoint with a body
 * const resultPost = await testEndpoint('/api/v1/messages', 'POST', { name: 'Test', message: 'Hello' });
 * printResult(resultPost);
 */
async function testEndpoint(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch {
      data = null;
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      endpoint,
      method,
      status: response.status,
      statusText: response.statusText,
      success: response.ok,
      responseTime,
      data,
      headers,
    };
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    return {
      endpoint,
      method,
      status: 0,
      statusText: 'Network Error',
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Prints the detailed result of an API endpoint test to the console using color-coded output.
 * It provides a summary of status, response time, data, and relevant headers.
 * @public
 * @param {TestResult} result - The {@link TestResult} object to be printed.
 * @returns {void}
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link TestResult}
 * @example
 * const mockResult: TestResult = {
 *   endpoint: '/api/v1/test', method: 'GET', status: 200, statusText: 'OK',
 *   success: true, responseTime: 120, data: { message: 'Success' }, headers: {}
 * };
 * printResult(mockResult);
 */
function printResult(result: TestResult) {
  const statusColor = result.success ? 'green' : result.status === 0 ? 'red' : 'yellow';
  const emoji = result.success ? '✅' : result.status === 0 ? '❌' : '⚠️';

  log(`\n${emoji} ${result.method} ${result.endpoint}`, 'bright');
  log(`   Status: ${result.status} ${result.statusText}`, statusColor);
  log(`   Response Time: ${result.responseTime}ms`, 'cyan');

  if (result.error) {
    log(`   Error: ${result.error}`, 'red');
  } else if (result.data) {
    log('   Data:', 'blue');
    if (typeof result.data === 'object') {
      const dataObj = result.data as Record<string, unknown>;
      const keys = Object.keys(dataObj);
      log(`   Keys: [${keys.join(', ')}]`, 'magenta');

      // Show first few items if it's an array
      if (Array.isArray(dataObj)) {
        log(`   Items: ${dataObj.length}`, 'magenta');
        if (dataObj.length > 0) {
          log(`   First item: ${JSON.stringify(dataObj[0], null, 2)}`, 'magenta');
        }
      }
      // Show success status if available
      else if ('success' in dataObj) {
        log(`   Success: ${dataObj.success}`, dataObj.success ? 'green' : 'red');
        if ('data' in dataObj) {
          log(`   Has data: ${typeof dataObj.data}`, 'magenta');
        }
        if ('error' in dataObj) {
          log(`   Error: ${dataObj.error}`, 'red');
        }
      }
    } else {
      log(`   ${String(result.data).substring(0, 200)}`, 'magenta');
    }
  }

  // Show important headers
  if (result.headers) {
    const importantHeaders = ['content-type', 'cache-control', 'x-ratelimit-remaining'];
    const relevantHeaders = importantHeaders
      .filter((h) => result.headers?.[h])
      .map((h) => `${h}: ${result.headers?.[h]}`);

    if (relevantHeaders.length > 0) {
      log(`   Headers: ${relevantHeaders.join(', ')}`, 'cyan');
    }
  }
}

/**
 * Executes a series of predefined API endpoint tests and logs a comprehensive summary.
 * This function iterates through a list of endpoints, calls {@link testEndpoint} for each,
 * prints the results using {@link printResult}, and then displays a final summary including
 * success rates, average response time, and details of any failed endpoints.
 * The process exits with a non-zero code if network errors occurred.
 * @public
 * @async
 * @returns {Promise<void>} A promise that resolves when all tests are complete.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link testEndpoint}
 * @see {@link printResult}
 * @example
 * // To run the tests, simply call the function:
 * runTests().catch(error => console.error("Test execution failed:", error));
 */
async function runTests() {
  log('\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║        API Endpoints Integration Test             ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');
  log(`\n🎯 Testing against: ${BASE_URL}\n`, 'cyan');

  const endpoints = [
    { name: 'Spotify - Now Playing', path: '/api/v1/now-playing' },
    { name: 'Spotify - Top Tracks', path: '/api/v1/top-tracks' },
    { name: 'Spotify - Top Artists', path: '/api/v1/top-artists' },
    { name: 'GitHub Stats', path: '/api/v1/github-stats' },
    { name: 'Discord Lanyard', path: '/api/v1/lanyard' },
    { name: 'WakaTime Stats', path: '/api/v1/wakatime' },
    { name: 'Blog Posts', path: '/api/v1/blog' },
    { name: 'Google Analytics', path: '/api/v1/google' },
    { name: 'Guestbook Messages', path: '/api/v1/messages' },
  ];

  const results: TestResult[] = [];

  for (const endpoint of endpoints) {
    log(`\n🔍 Testing: ${endpoint.name}...`, 'yellow');
    const result = await testEndpoint(endpoint.path);
    printResult(result);
    results.push(result);

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  log('\n\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║                   Test Summary                    ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝', 'bright');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && r.status !== 0).length;
  const errors = results.filter((r) => r.status === 0).length;
  const avgResponseTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
  );

  log(`\n✅ Successful: ${successful}/${results.length}`, 'green');
  log(`⚠️  Failed: ${failed}/${results.length}`, 'yellow');
  log(`❌ Network Errors: ${errors}/${results.length}`, 'red');
  log(`⚡ Average Response Time: ${avgResponseTime}ms`, 'cyan');

  // Performance breakdown
  log('\n📊 Performance Breakdown:', 'bright');
  results.forEach((result) => {
    const emoji = result.responseTime < 1000 ? '🚀' : result.responseTime < 3000 ? '✈️' : '🐌';
    log(`   ${emoji} ${result.endpoint}: ${result.responseTime}ms`, 'cyan');
  });

  // Failed endpoints details
  const failedEndpoints = results.filter((r) => !r.success);
  if (failedEndpoints.length > 0) {
    log('\n⚠️  Failed Endpoints:', 'red');
    failedEndpoints.forEach((result) => {
      log(`   • ${result.endpoint} (${result.status} ${result.statusText})`, 'red');
      if (result.error) {
        log(`     Error: ${result.error}`, 'red');
      }
    });
  }

  log('\n✨ Test complete!\n', 'green');

  // Exit with error code if any tests failed
  if (errors > 0) {
    process.exit(1);
  }
}

/**
 * Initiates the API testing process.
 * If any fatal errors occur during the execution of {@link runTests},
 * they are caught here, logged, and the process exits with an error code.
 * @async
 * @throws {Error} If an uncaught exception occurs during the test run.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link runTests}
 */
// Run the tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
