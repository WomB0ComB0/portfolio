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

import { t } from 'elysia';
import { AUTHOR_MAX_LENGTH, MESSAGE_MAX_LENGTH } from '@/lib/guestbook/limits';

export const messagesSchema = {
  'messages.get.response': t.Object({
    json: t.Object({
      json: t.Array(
        t.Object({
          id: t.String(),
          authorName: t.String(),
          message: t.String(),
          createdAt: t.String(),
        }),
      ),
    }),
  }),
  // The browser checks a draft first; these limits hold for any client. createMessage then checks
  // the text itself (validateUserInput) and answers 400 when nothing postable is left.
  'messages.post.body': t.Object({
    authorName: t.String({ minLength: 1, maxLength: AUTHOR_MAX_LENGTH }),
    message: t.String({ minLength: 1, maxLength: MESSAGE_MAX_LENGTH }),
  }),
  'messages.post.response': t.Object({
    id: t.String(),
    authorName: t.String(),
    message: t.String(),
    createdAt: t.String(),
  }),
  'messages.error': t.Object({
    error: t.String(),
  }),
};
