#!/usr/bin/env bun
/**
 * @file API Error Diagnostic Tool
 * @description This script provides a comprehensive diagnostic tool for API endpoints,
 * fetching detailed error information, response headers, and body content to aid in debugging failing endpoints.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://www.example.com/docs/api-diagnostics|API Diagnostics Documentation} (placeholder)
 * @example
 * // To run the diagnostic tool:
 * // bun src/__tests__/api-error-diagnostic.ts
 * // Ensure the NEXT_PUBLIC_SITE_URL environment variable is set, or it will default to http://localhost:3000
 */

/**
 * @const BASE_URL
 * @description The base URL for the API endpoints. Defaults to `http://localhost:3000` if `NEXT_PUBLIC_SITE_URL` is not set in environment variables.
 * @readonly
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * @const colors
 * @description An object containing ANSI escape codes for console text coloring.
 * @readonly
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
 * @function log
 * @description Logs a message to the console with optional ANSI color formatting.
 * @param {string} message The message string to log.
 * @param {keyof typeof colors} [color] Optional. The color key from the `colors` object to apply to the message.
 * @returns {void}
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * log('This is a normal message.');
 * log('This is an error message.', 'red');
 * log('This is a success message.', 'green');
 */
function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

/**
 * @function diagnoseEndpoint
 * @description Fetches data from a specified API endpoint, logs its response details, headers, body, and provides error analysis and recommendations if the request fails.
 * @async
 * @web
 * @param {string} endpoint The API endpoint path (e.g., '/api/v1/github-stats').
 * @returns {Promise<void>} A promise that resolves when the diagnostic process for the endpoint is complete.
 * @throws {Error} Throws an error if a network issue prevents the fetch operation (e.g., `ECONNREFUSED`).
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * // Diagnosing a specific endpoint
 * await diagnoseEndpoint('/api/v1/wakatime');
 */
async function diagnoseEndpoint(endpoint: string) {
  const url = `${BASE_URL}${endpoint}`;

  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`📍 Endpoint: ${endpoint}`, 'bright');
  log(`🌐 URL: ${url}`, 'blue');
  log(`${'='.repeat(60)}`, 'cyan');

  try {
    const startTime = performance.now();
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    log(`\n📊 Response Details:`, 'yellow');
    log(`   Status: ${response.status} ${response.statusText}`, response.ok ? 'green' : 'red');
    log(`   Response Time: ${responseTime}ms`, responseTime < 1000 ? 'green' : 'yellow');

    // Headers
    log(`\n📋 Response Headers:`, 'yellow');
    response.headers.forEach((value, key) => {
      log(`   ${key}: ${value}`, 'cyan');
    });

    // Body
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (e) {
      log(`\n❌ Failed to parse response body`, 'red');
      log(`   Error: ${e instanceof Error ? e.message : String(e)}`, 'red');
      return;
    }

    log(`\n📦 Response Body:`, 'yellow');
    if (typeof data === 'object' && data !== null) {
      log(JSON.stringify(data, null, 2), 'magenta');

      // Extract specific error information
      const dataObj = data as Record<string, unknown>;
      if ('error' in dataObj) {
        log(`\n🔍 Error Analysis:`, 'red');
        log(`   Error: ${JSON.stringify(dataObj.error, null, 2)}`, 'red');
      }
      if ('message' in dataObj) {
        log(`   Message: ${dataObj.message}`, 'red');
      }
      if ('stack' in dataObj) {
        log(`   Stack Trace:`, 'red');
        const stack = String(dataObj.stack).split('\n').slice(0, 10);
        stack.forEach((line) => log(`   ${line}`, 'red'));
      }
    } else {
      log(String(data), 'magenta');
    }

    // Recommendations
    if (!response.ok) {
      log(`\n💡 Possible Causes:`, 'yellow');

      if (response.status === 500) {
        log(`   • Server-side error in API route handler`, 'yellow');
        log(`   • External API timeout or failure`, 'yellow');
        log(`   • Missing or invalid environment variables`, 'yellow');
        log(`   • Database connection issue`, 'yellow');
      } else if (response.status === 401) {
        log(`   • Missing authentication credentials`, 'yellow');
        log(`   • Invalid or expired API tokens`, 'yellow');
      } else if (response.status === 404) {
        log(`   • Endpoint route not found`, 'yellow');
        log(`   • Incorrect URL path`, 'yellow');
      } else if (response.status === 429) {
        log(`   • Rate limit exceeded`, 'yellow');
        log(`   • Too many requests to external API`, 'yellow');
      }
    }
  } catch (error) {
    log(`\n❌ Network Error:`, 'red');
    log(`   ${error instanceof Error ? error.message : String(error)}`, 'red');

    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      log(`\n💡 Solution: Make sure the dev server is running (nr dev)`, 'yellow');
    }
  }
}

/**
 * @function main
 * @description The main execution function for the API Error Diagnostic Tool.
 * It initializes the diagnostic process, iterates through a predefined list of API endpoints,
 * and calls `diagnoseEndpoint` for each, with a brief pause between checks.
 * @async
 * @returns {Promise<void>} A promise that resolves when all endpoints have been diagnosed.
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * // The main function is automatically called at the end of the script.
 * // It orchestrates the diagnosis of all listed endpoints.
 */
async function main() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'bright');
  log('║          API Error Diagnostic Tool                       ║', 'bright');
  log('╚══════════════════════════════════════════════════════════╝', 'bright');
  log(`\n🎯 Testing against: ${BASE_URL}\n`, 'cyan');

  // Test all endpoints, focusing on the failing ones
  const endpoints = [
    '/api/v1/github-stats',
    '/api/v1/lanyard',
    '/api/v1/wakatime',
    '/api/v1/blog',
    '/api/v1/now-playing',
    '/api/v1/top-tracks',
    '/api/v1/top-artists',
    '/api/v1/google',
    '/api/v1/messages',
  ];

  for (const endpoint of endpoints) {
    await diagnoseEndpoint(endpoint);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  log('\n\n✨ Diagnostic complete!\n', 'green');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
