#!/usr/bin/env bun
/**
 * Cleanup Script
 * Run with: bun scripts/cleanup.ts
 *
 * This script cleans up any leftover cache or build artifacts
 */

import { $ } from 'bun';

async function cleanup() {
  console.log('🧹 Starting cleanup...\n');

  const tasks = [
    {
      name: 'Clear Next.js cache',
      command: 'rm -rf .next',
    },
    {
      name: 'Clear TypeScript build info',
      command: 'rm -rf tsconfig.tsbuildinfo',
    },
    {
      name: 'Clear test cache',
      command: 'rm -rf coverage .vitest',
    },
  ];

  for (const task of tasks) {
    try {
      console.log(`📦 ${task.name}...`);
      await $`${task.command.split(' ')}`;
      console.log(`   ✅ Done\n`);
    } catch (error) {
      console.log(`   ⚠️  Skipped (${error instanceof Error ? error.message : 'error'})\n`);
    }
  }

  console.log('✨ Cleanup complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Restart dev server: nr dev');
  console.log('   2. Run type checks: bun src/__tests__/type-check.ts');
  console.log('   3. Test APIs: bun src/__tests__/api-manual-test.ts\n');
}

cleanup().catch(console.error);
