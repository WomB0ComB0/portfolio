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
 * Converts any object into a well-formatted JSON string with a 2-space indent.
 * Useful for human-readable output, debugging, data serialization, and logging.
 *
 * @author Mike Odnis
 * @param {object} obj The object to be stringified.
 * @returns {string} The stringified JSON with indentation.
 * @throws {TypeError} Throws if the input object contains circular references.
 * @example
 *   const formatted = Stringify({user: "John", age: 30});
 *   // returns '{\n  "user": "John",\n  "age": 30\n}'
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
 * @version 1.0.0
 */
export const Stringify = (obj: object): string => {
  return JSON.stringify(obj, null, 2);
};
