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
 * @file Vitest Global Setup
 * @description Global setup for all Vitest tests. Runs once before all tests.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// next/font/google's runtime module is empty outside Next's SWC transform, so importing
// src/app/fonts.ts (the root layout does) would crash. Each loader is a spy that returns its own
// class-like `variable`, as next/font does (a generated class name, not the CSS variable it was
// given), so a test can tell which loader a value came from and catch a hard-coded one.
vi.mock('next/font/google', () => {
  const fontLoader = (variableClass: string) =>
    vi.fn(() => ({
      className: 'font-mock',
      variable: variableClass,
      style: { fontFamily: 'mock' },
    }));
  return {
    Geist: fontLoader('geist-variable-mock'),
    Geist_Mono: fontLoader('mono-variable-mock'),
  };
});

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Mock window.matchMedia for jsdom
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = () => {};
  disconnect = () => {};
  unobserve = () => {};
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = () => {};
  disconnect = () => {};
  unobserve = () => {};
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Suppress console errors in tests (optional, remove if you want to see them)
// console.error = () => {};
