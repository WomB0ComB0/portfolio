#!/usr/bin/env bun
// -*- typescript -*-
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageJson } from 'type-fest';

const rootDir = join(__dirname, '..', '..');
const packageJsonPath = join(rootDir, 'package.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;

const dependencies =
  packageJson.dependencies ||
  (() => {
    throw new Error('No dependencies found');
  })();

const devDependencies =
  packageJson.devDependencies ||
  (() => {
    throw new Error('No dev dependencies found');
  })();

const picked = {
  ...Object.entries(dependencies)
    .filter(([key, _]) => {
      return !devDependencies[key];
    })
    .map(([key, value]) => {
      return [key, value];
    })
    .reduce(
      (acc, [key, value]) => {
        if (!key || !value || acc[key]) return acc;
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    ),
};

if (require.main === module) {
  (async () => {
    try {
      packageJson.dependencies = picked;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } catch (error) {
      console.error(`${error instanceof Error ? error.message : error}`);
    } finally {
      process.exit(0);
    }
  })();
}
