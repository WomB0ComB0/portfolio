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
 * @file Decodes Sanity answers one document at a time, so one invalid CMS document is dropped
 * (and reported) instead of failing the whole page.
 *
 * - Each document is decoded on its own with the schema's default options: excess properties
 *   are ignored, the valid documents keep their input order.
 * - An answer with invalid documents sends ONE Sentry warning (context `decode <collection>`)
 *   that lists each invalid document's `_id` and what is wrong with it.
 * - Results are memoized by the answer's identity. The loaders hand the same cached array to
 *   every request until Sanity is asked again, so each answer is decoded and reported once.
 */

import { Either, ParseResult, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import { reportApiFailure } from '@/lib/observability/report';

/** How much of a document's validation message a report keeps. */
const MAX_PROBLEM_LENGTH = 300;
const MISSING_ID = '(no _id)';

/** An invalid document, as a report lists it. */
export interface InvalidDocument {
  readonly id: string;
  readonly problem: string;
}

/** Decoded results by input (array or document), then by schema. */
type DecodeMemo = WeakMap<object, WeakMap<object, unknown>>;

let listMemo: DecodeMemo = new WeakMap();
let documentMemo: DecodeMemo = new WeakMap();

/** Forgets every decoded answer. Tests only. */
export function resetDecodeMemo(): void {
  listMemo = new WeakMap();
  documentMemo = new WeakMap();
}

/** Answers what `decode` computed for `input` with `schema` before, or computes and keeps it. */
function memoized<R>(memo: DecodeMemo, input: object, schema: object, decode: () => R): R {
  const bySchema = memo.get(input) ?? new WeakMap<object, unknown>();
  if (bySchema.has(schema)) return bySchema.get(schema) as R;
  const result = decode();
  bySchema.set(schema, result);
  memo.set(input, bySchema);
  return result;
}

const idOf = (doc: unknown): string => {
  const id = typeof doc === 'object' && doc !== null ? (doc as { _id?: unknown })._id : undefined;
  return typeof id === 'string' && id.length > 0 ? id : MISSING_ID;
};

/**
 * What is wrong, by field: `category: Expected "Hackathon" | ..., actual "Workshop"`. The tree
 * formatter's message starts with the schema's whole type, which alone fills the length limit
 * for most collections, so the field-level issues are listed instead.
 */
const problemOf = (error: ParseResult.ParseError): string =>
  ParseResult.ArrayFormatter.formatErrorSync(error)
    .map(({ path, message }) =>
      path.length > 0 ? `${path.map(String).join('.')}: ${message}` : message,
    )
    .join('; ')
    .slice(0, MAX_PROBLEM_LENGTH);

/**
 * One warning for an answer of `total` documents, `invalid` of which failed. Sent without the
 * context's cooldown: the memo already reports each answer once, and a throttled report would
 * never be retried, so a second answer's invalid documents would go unreported.
 */
function reportInvalid(
  collection: string,
  total: number,
  invalid: readonly InvalidDocument[],
): void {
  const summary = `${invalid.length} of ${total} ${collection} documents failed validation`;
  reportApiFailure(
    ensureBaseError(new Error(summary), `sanity:decode:${collection}`, { invalid }),
    { context: `decode ${collection}`, level: 'warning', cooldown: false },
  );
}

/**
 * The documents of `docs` that decode with `schema`, in input order. Invalid ones are dropped
 * and reported once per answer.
 */
export function decodeEach<A, I>(
  schema: Schema.Schema<A, I, never>,
  docs: readonly unknown[],
  collection: string,
): readonly A[] {
  return memoized(listMemo, docs, schema, () => {
    const decode = Schema.decodeUnknownEither(schema);
    const results = docs.map((doc) => ({ doc, result: decode(doc) }));
    const invalid = results.flatMap(({ doc, result }) =>
      Either.isLeft(result) ? [{ id: idOf(doc), problem: problemOf(result.left) }] : [],
    );
    if (invalid.length > 0) reportInvalid(collection, docs.length, invalid);
    return results.flatMap(({ result }) => (Either.isRight(result) ? [result.right] : []));
  });
}

/**
 * `doc` decoded with `schema`: null for a missing document (null or undefined, not reported) and
 * for an invalid one (reported once per object).
 */
export function decodeOne<A, I>(
  schema: Schema.Schema<A, I, never>,
  doc: unknown,
  collection: string,
): A | null {
  if (doc === null || doc === undefined) return null;

  const decode = (): A | null => {
    const result = Schema.decodeUnknownEither(schema)(doc);
    if (Either.isRight(result)) return result.right;
    reportInvalid(collection, 1, [{ id: idOf(doc), problem: problemOf(result.left) }]);
    return null;
  };
  return typeof doc === 'object' ? memoized(documentMemo, doc, schema, decode) : decode();
}
