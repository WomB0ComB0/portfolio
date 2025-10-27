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

import { logger } from "@/utils";
import { Elysia, StatusMap } from 'elysia';
import { createMessage, fetchMessages } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { messagesSchema } from './schema';

export const messagesRoute = new Elysia({ prefix: '/messages' })
  .model(messagesSchema)
  .get(
    '/',
    async ({ set }) => {
      try {
        const data = await fetchMessages();
        set.headers = cacheHeaders();
        return {
          json: {
            json: data.json.map((item) => ({
              id: item.id,
              authorName: item.authorName,
              message: item.message,
              createdAt: item.createdAt,
            })),
          },
        };
      } catch (error) {
        const errorResponse = errorHandler(error, 'fetch');
        set.status = StatusMap['Internal Server Error'];
        logger.error('Error fetching messages:', error);
        return { error: errorResponse.error };
      }
    },
    {
      response: {
        200: 'messages.get.response',
        500: 'messages.error',
      },
    },
  )
  .post(
    '/',
    async ({ body, set }) => {
      try {
        const newMessage = await createMessage(body);
        set.status = StatusMap.Created;
        set.headers = cacheHeaders();
        return newMessage;
      } catch (error) {
        const errorResponse = errorHandler(error, 'add');
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      body: 'messages.post.body',
      response: {
        201: 'messages.post.response',
        500: 'messages.error',
      },
    },
  );
