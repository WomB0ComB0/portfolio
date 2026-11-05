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
 * @file State that every copy of a module in one server process shares.
 *
 * Next's bundler loads a module once for route handlers and once for pages, even within one Node
 * process, so a module-level `let cache` gives the page and `/api/v1/*` separate caches. A value
 * kept here lives on `globalThis` under a `Symbol.for` key instead, so every copy finds the same
 * one.
 */

const registryKey = (name: string): symbol => Symbol.for(`portfolio.process.${name}`);

/**
 * The process-wide value named `name`, created by `init` on first use.
 *
 * Every copy of a module that asks for the same name gets the same object, so keep it mutable
 * (for example `{ cache: null }`) and change its fields rather than replacing it.
 *
 * @param name - A stable, unique name, such as `'github-stats.cache'`.
 * @param init - Builds the initial value; runs once per process.
 */
export function processGlobal<T extends object>(name: string, init: () => T): T {
  const store = globalThis as typeof globalThis & Record<symbol, T | undefined>;
  const key = registryKey(name);
  store[key] ??= init();
  return store[key];
}

/** Forgets the value named `name`, so the next {@link processGlobal} call builds it again. For tests. */
export function resetProcessGlobal(name: string): void {
  const store = globalThis as typeof globalThis & Record<symbol, unknown>;
  delete store[registryKey(name)];
}
