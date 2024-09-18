#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

// edited to work with the appdir by @raphaelbadia

// @ts-check
const gzSize = require('gzip-size');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

/** @typedef {{ raw: number, gzip: number }} ScriptSizes */
/** @typedef {Record<string, ScriptSizes>} PageSizes */
/** @typedef {Record<string, string[]>} BuildManifestPages */

/** @typedef {{
 *   pages: BuildManifestPages,
 *   rootMainFiles: string[]
 * }} BuildManifest */

/** @typedef {{
 *   pages: BuildManifestPages
 * }} AppDirManifest */

/** @typedef {{
 *   buildOutputDirectory?: string,
 *   name: string
 * }} Options */

// Pull options from `package.json`
/** @type {Options} */
const options = getOptions();
const BUILD_OUTPUT_DIRECTORY = getBuildOutputDirectory(options);

// first we check to make sure that the build output directory exists
const nextMetaRoot = path.join(process.cwd(), BUILD_OUTPUT_DIRECTORY);
try {
  fs.accessSync(nextMetaRoot, fs.constants.R_OK);
} catch (err) {
  console.error(
    `No build output found at "${nextMetaRoot}" - you may not have your working directory set correctly, or not have run "next build".`,
  );
  process.exit(1);
}

// if so, we can import the build manifest
/** @type {BuildManifest} */
const buildMeta = require(path.join(nextMetaRoot, 'build-manifest.json'));
/** @type {AppDirManifest} */
const appDirMeta = require(path.join(nextMetaRoot, 'app-build-manifest.json'));

/** @type {Record<string, [number, number]>} */
const memoryCache = {};

const globalBundle = buildMeta.pages['/_app'] || [];
const globalBundleSizes = getScriptSizes(globalBundle);

/** @type {PageSizes} */
const allPageSizes = Object.entries(buildMeta.pages).reduce(
  (acc, [pagePath, scriptPaths]) => {
    const scriptSizes = getScriptSizes(
      scriptPaths.filter((scriptPath) => !globalBundle.includes(scriptPath)),
    );
    acc[pagePath] = scriptSizes;
    return acc;
  },
  /** @type {PageSizes} */ ({}),
);

const globalAppDirBundle = buildMeta.rootMainFiles || [];
const globalAppDirBundleSizes = getScriptSizes(globalAppDirBundle);

/** @type {PageSizes} */
const allAppDirSizes = Object.entries(appDirMeta.pages).reduce(
  (acc, [pagePath, scriptPaths]) => {
    const scriptSizes = getScriptSizes(
      scriptPaths.filter((scriptPath) => !globalAppDirBundle.includes(scriptPath)),
    );
    acc[pagePath] = scriptSizes;
    return acc;
  },
  /** @type {PageSizes} */ ({}),
);

// format and write the output
const rawData = JSON.stringify({
  ...allAppDirSizes,
  __global: globalAppDirBundleSizes,
});

// log outputs to the gh actions panel
console.log(rawData);

mkdirp.sync(path.join(nextMetaRoot, 'analyze/'));
fs.writeFileSync(path.join(nextMetaRoot, 'analyze/__bundle_analysis.json'), rawData);

// --------------
// Util Functions
// --------------

/**
 * @param {string[]} scriptPaths
 * @returns {ScriptSizes}
 */
function getScriptSizes(scriptPaths) {
  return scriptPaths.reduce(
    (acc, scriptPath) => {
      const [rawSize, gzipSize] = getScriptSize(scriptPath);
      acc.raw += rawSize;
      acc.gzip += gzipSize;
      return acc;
    },
    { raw: 0, gzip: 0 },
  );
}

/**
 * @param {string} scriptPath
 * @returns {[number, number]}
 */
function getScriptSize(scriptPath) {
  const encoding = 'utf8';
  const p = path.join(nextMetaRoot, scriptPath);

  if (p in memoryCache) {
    return memoryCache[p] || [0, 0];
  }

  try {
    const textContent = fs.readFileSync(p, encoding);
    const rawSize = Buffer.byteLength(textContent, encoding);
    const gzipSize = gzSize.sync(textContent);
    memoryCache[p] = [rawSize, gzipSize];
    return [rawSize, gzipSize];
  } catch (error) {
    console.error(`Error reading file: ${p}`, error);
    return [0, 0];
  }
}

/**
 * @param {string} [pathPrefix]
 * @returns {Options}
 */
function getOptions(pathPrefix = process.cwd()) {
  try {
    /** @type {{nextBundleAnalysis?: Partial<Options>, name: string}} */
    const pkg = require(path.join(pathPrefix, 'package.json'));
    return { ...pkg.nextBundleAnalysis, name: pkg.name };
  } catch (error) {
    console.error('Error reading package.json', error);
    return { name: 'unknown' };
  }
}

/**
 * @param {Options} options
 * @returns {string}
 */
function getBuildOutputDirectory(options) {
  return options.buildOutputDirectory || '.next';
}
