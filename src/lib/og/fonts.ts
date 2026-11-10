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

import 'server-only';

/**
 * @file The site's two typefaces for the link-preview cards, as TrueType files next/og can read
 * (it reads no WOFF2, which next/font serves the pages). Static Geist and Geist Mono instances
 * from Google Fonts, under the SIL Open Font License (src/lib/og/fonts/OFL.txt).
 *
 * One change to the Geist files: their GPOS 'kern' feature is renamed 'xern', so nothing applies
 * it. Satori measures a word glyph by glyph, unkerned, but drew it kerned, so a word whose
 * letters kern together ended short of the box it was measured for and the space after it looked
 * doubled ("Explore  my"). Unkerned, the two agree. Geist Mono has no kern feature.
 *
 * Read with the Node runtime from the project directory, each path written out in full so the
 * build's file tracing copies the faces next to the server code (a standalone build or a Vercel
 * function has no other copy). Loaded once per server; a failed read is not cached, so the next
 * card tries again.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** A face as next/og takes it. */
export interface OgFont {
  readonly name: 'Geist' | 'Geist Mono';
  readonly data: ArrayBuffer;
  readonly weight: 400 | 500 | 600;
  readonly style: 'normal';
}

/** The bytes of a Buffer as their own ArrayBuffer (a Buffer may share a larger pool). */
const bytesOf = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

let loading: Promise<readonly OgFont[]> | undefined;

/** Reads the four faces from disk. */
async function readFaces(): Promise<readonly OgFont[]> {
  const [regular, medium, semibold, mono] = await Promise.all([
    readFile(join(process.cwd(), 'src/lib/og/fonts/Geist-Regular.ttf')),
    readFile(join(process.cwd(), 'src/lib/og/fonts/Geist-Medium.ttf')),
    readFile(join(process.cwd(), 'src/lib/og/fonts/Geist-SemiBold.ttf')),
    readFile(join(process.cwd(), 'src/lib/og/fonts/GeistMono-Regular.ttf')),
  ]);
  return [
    { name: 'Geist', data: bytesOf(regular), weight: 400, style: 'normal' },
    { name: 'Geist', data: bytesOf(medium), weight: 500, style: 'normal' },
    { name: 'Geist', data: bytesOf(semibold), weight: 600, style: 'normal' },
    { name: 'Geist Mono', data: bytesOf(mono), weight: 400, style: 'normal' },
  ];
}

/**
 * Geist 400, 500 and 600 and Geist Mono 400, read once and shared by every card. A read that
 * fails rejects this call and is forgotten, so a later call reads again.
 */
export function loadOgFonts(): Promise<readonly OgFont[]> {
  loading ??= readFaces().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
