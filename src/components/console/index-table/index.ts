/**
 * Copyright 2026 Mike Odnis
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
 * @file The IndexTable kit: year groups of real tables with columns as data, the tint row hover,
 * a stretched title link and actions above it. Style 1 (`ledger`) on /certifications; style 2
 * (`open`) is the same markup for /projects. No directive: the markup and classes are
 * server-safe, and IndexCopyButton carries its own 'use client'.
 */

export { IndexCopyButton, type IndexCopyButtonProps } from './copy-button';
export {
  IndexAnnouncer,
  IndexGroup,
  type IndexGroupProps,
  IndexRow,
  type IndexRowProps,
  IndexTitleLink,
  type IndexTitleLinkProps,
} from './index-table';
export {
  INDEX_ACTION_CLASS,
  INDEX_COPY_CLASS,
  INDEX_GROUPS_CLASS,
  INDEX_META_CLASS,
  INDEX_ROW_INK_CLASS,
  INDEX_SUB_CLASS,
  INDEX_TITLE_TEXT_CLASS,
  type IndexAlign,
  type IndexColumn,
  type IndexPriority,
  type IndexVariant,
  indexCellClass,
  indexColClass,
  indexHeaderClass,
} from './index-table-classes';
