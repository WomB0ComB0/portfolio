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
 * @file cn() knows the Live Console theme (src/styles/globals.css): a type-scale class such as
 * text-stat is a font size, not a colour, so it never knocks out text-foreground, and the
 * console's own radius, shadow, tracking, easing and container names merge with their groups.
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

const TYPE_SCALE = [
  'label',
  'meta',
  'body-sm',
  'body',
  'title',
  'heading',
  'stat',
  'display',
  'hero',
] as const;

describe('cn with the Live Console theme', () => {
  it.each(TYPE_SCALE)('keeps a text colour beside text-%s (a font size)', (size) => {
    expect(cn('text-foreground', `text-${size}`)).toBe(`text-foreground text-${size}`);
    expect(cn(`text-${size}`, 'text-muted-foreground')).toBe(`text-${size} text-muted-foreground`);
  });

  it('lets a later type-scale class replace an earlier font size', () => {
    expect(cn('text-title', 'text-label')).toBe('text-label');
    expect(cn('text-sm', 'text-meta')).toBe('text-meta');
    expect(cn('self-end text-foreground', 'text-stat')).toBe('self-end text-foreground text-stat');
  });

  it('still lets a later text colour replace an earlier one', () => {
    expect(cn('text-foreground', 'text-muted-foreground')).toBe('text-muted-foreground');
  });

  it('treats tracking-display/stat/label as letter spacing', () => {
    expect(cn('tracking-normal', 'tracking-display')).toBe('tracking-display');
    expect(cn('tracking-label', 'tracking-stat')).toBe('tracking-stat');
  });

  it('treats rounded-tile as a radius', () => {
    expect(cn('rounded-md', 'rounded-tile')).toBe('rounded-tile');
  });

  it('treats shadow-tile/raised/lift as shadows, not shadow colours', () => {
    expect(cn('shadow-sm', 'shadow-raised')).toBe('shadow-raised');
    expect(cn('shadow-raised', 'shadow-black')).toBe('shadow-raised shadow-black');
    expect(cn('shadow-tile', 'shadow-lift')).toBe('shadow-lift');
  });

  it('treats ease-out-expo and ease-standard as easings', () => {
    expect(cn('ease-in', 'ease-out-expo')).toBe('ease-out-expo');
    expect(cn('ease-out-expo', 'ease-standard')).toBe('ease-standard');
  });

  it('treats max-w-shell as a max width', () => {
    expect(cn('max-w-md', 'max-w-shell')).toBe('max-w-shell');
  });
});
