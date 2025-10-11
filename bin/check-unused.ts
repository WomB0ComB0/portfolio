import fs from 'node:fs';
import path from 'node:path';
import { $ } from 'bun';
import depcheck from 'depcheck';
import type { PackageJson } from 'type-fest';

// If you're coming from GitHub Gist, you can remove or change this
const rootDir = path.join(__dirname, '..'); // Go up one level to project root
const packageJsonPath = path.join(rootDir, 'package.json');
console.log('Checking:', packageJsonPath);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
const OUTPUT_DIR = './scripts/out';

const options = {
  ignoreMatches: [
    // Common false positives
    '@types/*',
    'typescript',
    'autoprefixer',
    'postcss',
    'tailwindcss',
    'eslint*',
    'prettier*',
  ],
  ignorePatterns: [
    'dist',
    'build',
    '.next',
    'public',
    'node_modules',
    'coverage',
    'scripts',
    'out',
    '.next',
    '.vscode',
    'prisma',
    '.idea',
    '.github',
  ],
  skipMissing: false,
};

if (!fs.existsSync('./node_modules/depcheck')) {
  $`npm install depcheck`;
}

// Run depcheck on the root directory, not scripts directory
depcheck(rootDir, options)
  .then((unused: any) => {
    console.log('\nUnused Dependencies:');
    fs.writeFileSync(
      `${OUTPUT_DIR}/unused-dependencies.json`,
      JSON.stringify(unused.dependencies, null, 2),
    );

    console.log('\nUnused DevDependencies:');
    fs.writeFileSync(
      `${OUTPUT_DIR}/unused-dev-dependencies.json`,
      JSON.stringify(unused.devDependencies, null, 2),
    );

    console.log('\nMissing Dependencies:');
    fs.writeFileSync(
      `${OUTPUT_DIR}/missing-dependencies.json`,
      JSON.stringify(unused.missing, null, 2),
    );

    const allDependencies = Object.keys(packageJson.dependencies || {}).concat(
      Object.keys(packageJson.devDependencies || {}),
    );

    const usedDependencies = allDependencies.filter(
      (dep) => !unused.dependencies.includes(dep) && !unused.devDependencies.includes(dep),
    );

    console.log('\nChecking sub-dependencies...');
    usedDependencies.forEach((dep) => {
      const depPackageJsonPath = path.join(rootDir, 'node_modules', dep, 'package.json');
      if (fs.existsSync(depPackageJsonPath)) {
        const depPackageJson = JSON.parse(
          fs.readFileSync(depPackageJsonPath, 'utf8'),
        ) as PackageJson;
        const subDependencies = Object.keys(depPackageJson.dependencies || {});

        subDependencies.forEach((subDep) => {
          if (!allDependencies.includes(subDep) && !unused.missing[subDep]) {
            fs.appendFileSync(`${OUTPUT_DIR}/unused-sub-dependencies.json`, `"${subDep}",\n`);
          }
        });
      }
    });
  })
  .catch((error: Error) => {
    console.error('Error running depcheck:', error);
    process.exit(1);
  });
