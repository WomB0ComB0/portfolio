#!/usr/bin/env tsx

// -*- typescript -*-

/**
 * Copyright 2025 Mike Odnis
 * Licensed under the Apache License, Version 2.0
 */

import depcheck from 'depcheck';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';

// Optional Bun shell (used only if available)
let bun$: ((strings: TemplateStringsArray, ...expr: any[]) => Promise<any>) | null = null;
try {
  const { $ } = await import('bun');
  bun$ = $;
} catch {}

/* --------------------------- Path + FS utilities --------------------------- */

// project root = parent of scripts/ by default
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');

console.log('Project root:', rootDir);
console.log('Checking:', pkgPath);

if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found at', pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;

const OUT_DIR = path.join(rootDir, 'scripts', 'out');
await fsp.mkdir(OUT_DIR, { recursive: true });

/** Atomic write: write to tmp, then rename (reduces partial write risk). */
async function writeJsonAtomic<T>(dest: string, data: T) {
  const tmp = `${dest}.tmp-${Date.now()}`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, dest);
}

/* ------------------------------- depcheck run ------------------------------ */

const options: depcheck.Options = {
  // Good defaults; tweak as needed
  ignoreMatches: [
    '@types/*',
    'typescript',
    'eslint*',
    'prettier*',
    'autoprefixer',
    'postcss',
    'tailwindcss',
  ],
  ignorePatterns: [
    // build outputs & tooling dirs
    'dist',
    'build',
    '.next',
    'out',
    'coverage',
    'public',
    'node_modules',
    'bin',
    '.vscode',
    '.idea',
    '.github',
    'prisma',
  ],
  skipMissing: false,

  // Parse TS/TSX properly
  parsers: {
    // These wildcards are what depcheck expects
    '**/*.ts': depcheck.parser.typescript,
    '**/*.tsx': depcheck.parser.typescript,
    '**/*.js': depcheck.parser.es6,
    '**/*.jsx': depcheck.parser.jsx,
  },

  // Detect usages across common patterns
  detectors: [
    depcheck.detector.importDeclaration,
    depcheck.detector.requireCallExpression,
    // depcheck.detector.dynamicImport,
    depcheck.detector.exportDeclaration,
    depcheck.detector.typescriptImportEqualsDeclaration,
  ],

  // Account for config-file-based usage
  specials: [
    depcheck.special.eslint,
    depcheck.special.jest,
    // depcheck.special.tsconfig,
    depcheck.special.babel,
    depcheck.special.webpack,
    depcheck.special.bin,
  ],
};

async function ensureDepcheckInstalled() {
  // If depcheck isn't resolvable from local node_modules, install dev dep.
  // Prefer Bun if present; otherwise fall back to npm.
  try {
    require.resolve('depcheck', { paths: [rootDir] });
  } catch {
    if (bun$) {
      console.log('Installing depcheck via Bun…');
      await bun$`bun add -D depcheck`;
    } else {
      console.log('Installing depcheck via npm…');
      // Using npx would not make it importable; install instead.
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('npm', ['i', '-D', 'depcheck'], { stdio: 'inherit', cwd: rootDir });
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
  }
}

await ensureDepcheckInstalled();

type DepcheckResult = {
  dependencies: string[];
  devDependencies: string[];
  missing: Record<string, string[]>;
  using: Record<string, string[]>;
  invalidFiles: Record<string, Error>;
  invalidDirs: Record<string, Error>;
};

console.time('depcheck');
const result = (await depcheck(rootDir, options)) as DepcheckResult;
console.timeEnd('depcheck');

/* ----------------------------- Report building ----------------------------- */

const allTopLevel = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
];

const unusedDeps = result.dependencies ?? [];
const unusedDevDeps = result.devDependencies ?? [];
const missing = result.missing ?? {};

// “used” = top-level minus what depcheck flagged as unused
const usedTopLevel = allTopLevel.filter(
  (d) => !unusedDeps.includes(d) && !unusedDevDeps.includes(d),
);

// Potentially-unused *sub*-dependencies: dependency’s own deps that your app
// never references directly (i.e., not top-level, and not reported missing).
const maybeUnusedSubDeps = new Set<string>();

for (const dep of usedTopLevel) {
  const depPkgPath = path.join(rootDir, 'node_modules', dep, 'package.json');
  if (!fs.existsSync(depPkgPath)) continue;

  try {
    const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8')) as PackageJson;
    const subs = Object.keys(depPkg.dependencies ?? {});
    for (const sub of subs) {
      if (!allTopLevel.includes(sub) && !missing[sub]) {
        maybeUnusedSubDeps.add(sub);
      }
    }
  } catch {
    // ignore unreadable package.json for a sub-dependency
  }
}

/* --------------------------------- Output ---------------------------------- */

const outputs = {
  unusedDependencies: Array.from(unusedDeps).sort((a, b) => a.localeCompare(b)),
  unusedDevDependencies: Array.from(unusedDevDeps).sort((a, b) => a.localeCompare(b)),
  missingDependencies: Object.fromEntries(
    Object.entries(missing).sort(([a], [b]) => a.localeCompare(b)),
  ),
  // Note: “potential” — sub-deps are consumed by other deps; treat as advisory
  potentialUnusedSubDependencies: Array.from(maybeUnusedSubDeps).sort((a, b) => a.localeCompare(b)),
  summary: {
    totalTopLevel: allTopLevel.length,
    unusedDependencies: unusedDeps.length,
    unusedDevDependencies: unusedDevDeps.length,
    missingDependencies: Object.keys(missing).length,
    potentialUnusedSubDependencies: maybeUnusedSubDeps.size,
  },
};

await writeJsonAtomic(path.join(OUT_DIR, 'dependencies-report.json'), outputs);

// Also emit the individual files (overwritten if they exist)
await writeJsonAtomic(path.join(OUT_DIR, 'unused-dependencies.json'), outputs.unusedDependencies);
await writeJsonAtomic(
  path.join(OUT_DIR, 'unused-dev-dependencies.json'),
  outputs.unusedDevDependencies,
);
await writeJsonAtomic(path.join(OUT_DIR, 'missing-dependencies.json'), outputs.missingDependencies);
await writeJsonAtomic(
  path.join(OUT_DIR, 'unused-sub-dependencies.json'),
  outputs.potentialUnusedSubDependencies,
);

console.log('\nDependency check complete. Reports written to:', OUT_DIR);
console.log(outputs.summary);

// Exit non-zero if issues are found (useful for CI)
if (
  outputs.unusedDependencies.length ||
  outputs.unusedDevDependencies.length ||
  Object.keys(outputs.missingDependencies).length
) {
  process.exitCode = 2;
}
