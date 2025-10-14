#!/usr/bin/env bun
/**
 * Manual API Testing Script
 * Run with: bun src/__tests__/api-manual-test.ts
 *
 * This script tests all API endpoints and logs detailed results to the console.
 * Use this for quick manual testing during development.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

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

// Run the tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
