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
 * @file jest-dom matcher types for Vitest 5
 * @description Vitest 5 no longer reads matcher declarations from the global
 * `jest.Matchers` interface, and `Assertion` now takes `<R, T>`. The jest-dom
 * typings only cover the old shapes, so the matchers registered in
 * `vitest.setup.ts` are declared on `vitest`'s `Matchers<R, T>` here.
 */

import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import 'vitest';

declare module 'vitest' {
  interface Matchers<R, T> extends TestingLibraryMatchers<any, R> {}
}
