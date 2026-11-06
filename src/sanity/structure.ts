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
 * @file The Studio's content list, and the config that keeps a singleton single. The site
 * settings open as one item, its fixed-id document, at the top; every other type keeps its
 * generated list. A singleton cannot be created from the "Create" menu, deleted, duplicated or
 * unpublished: the site reads that one id, and any other copy would be ignored.
 *
 * Relative imports only: the Studio's own build does not resolve the app's '@/' alias.
 */

import type { DocumentActionComponent, DocumentActionsContext, Template } from 'sanity';
import type { StructureResolver } from 'sanity/structure';
import { SITE_SETTINGS_ID, SITE_SETTINGS_TYPE } from './schemaTypes/site-settings';

/** Types with exactly one document, at a fixed id. */
const SINGLETON_TYPES: ReadonlySet<string> = new Set([SITE_SETTINGS_TYPE]);

/** What a singleton may do: publish, and undo unpublished edits. Nothing that adds or removes one. */
const SINGLETON_ACTIONS: ReadonlySet<string> = new Set(['publish', 'discardChanges', 'restore']);

const SITE_SETTINGS_TITLE = 'Site settings';

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title(SITE_SETTINGS_TITLE)
        .id(SITE_SETTINGS_ID)
        .schemaType(SITE_SETTINGS_TYPE)
        .child(
          S.document()
            .schemaType(SITE_SETTINGS_TYPE)
            .documentId(SITE_SETTINGS_ID)
            .title(SITE_SETTINGS_TITLE),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => !SINGLETON_TYPES.has(item.getId() ?? '')),
    ]);

/** For `schema.templates`: the new-document templates, without the singletons'. */
export const withoutSingletonTemplates = (templates: Template[]): Template[] =>
  templates.filter(({ schemaType }) => !SINGLETON_TYPES.has(schemaType));

/** For `document.actions`: a singleton keeps only {@link SINGLETON_ACTIONS}; others keep all. */
export const singletonSafeActions = (
  actions: DocumentActionComponent[],
  { schemaType }: Pick<DocumentActionsContext, 'schemaType'>,
): DocumentActionComponent[] =>
  SINGLETON_TYPES.has(schemaType)
    ? actions.filter(({ action }) => action !== undefined && SINGLETON_ACTIONS.has(action))
    : actions;
