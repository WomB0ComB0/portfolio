#!/usr/bin/env bun
/**
 * API Error Diagnostic Tool
 * Run with: bun src/__tests__/api-error-diagnostic.ts
 *
 * This script fetches detailed error information from failing API endpoints
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
