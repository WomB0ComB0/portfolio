import type { ApiResponse, Message, MutationContext } from './use-messages.types';

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

('use client');

import { post } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';

/**
 * @readonly
 * @description
 * A schema definition using Effect's schema utilities to validate and transform a single message object.
 * Enforces runtime type validation for API data interchange.
 * @author Mike Odnis
 * @version 1.0.0
 * @see Message
 * @private
 */
const MessageSchema = Schema.Struct({
  id: Schema.String,
  message: Schema.String,
  authorName: Schema.String,
  createdAt: Schema.String,
  email: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
});

/**
 * Custom React hook to handle posting a message to the portfolio message API endpoint,
 * utilizing React Query's mutation capabilities with optimistic cache updates and Effect runtime validation.
 *
 * Sets up the necessary mutation logic for submitting new messages, including error recovery and cache management.
 *
 * @function usePostMessage
 * @returns {ReturnType<typeof useMutation<Message, Error, Message, MutationContext>>}
 *         Returns the mutation result with mutation methods and state.
 * @throws {Error} Throws if the message post request fails or if runtime schema validation fails.
 * @web
 * @public
 * @async
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/mutations
 * @see Message
 * @see ApiResponse
 * @example
 * const { mutate: postMessage, isPending } = usePostMessage();
 * postMessage({ id, message: 'Hello', authorName: 'WomB0ComB0', createdAt: new Date().toISOString() });
 */
export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, Message, MutationContext>({
    /**
     * Performs the asynchronous POST request to submit a new message via the portfolio API,
     * with runtime schema validation provided by Effect.
     *
     * @param {Message} newMessage - The message object to be posted.
     * @returns {Promise<Message>} The newly created message object as returned by the API.
     * @throws {Error} If the API request fails or schema validation fails.
     * @async
     * @author Mike Odnis
     */
    mutationFn: async (newMessage) => {
      // Convert Message to plain object for Effect fetcher
      const messageData = {
        id: newMessage.id,
        message: newMessage.message,
        authorName: newMessage.authorName,
        createdAt: newMessage.createdAt,
        ...(newMessage.email && { email: newMessage.email }),
      };

      const effect = pipe(
        post('/api/v1/messages', messageData, {
          retries: 2,
          timeout: 10_000,
          schema: MessageSchema,
        }),
        Effect.provide(FetchHttpClient.layer),
      );

      return await Effect.runPromise(effect);
    },
    /**
     * Called before the mutation request is sent to the server.
     * Optimistically updates messages in the client cache.
     *
     * @param {Message} newMessage - The message to be posted.
     * @returns {Promise<MutationContext>} Returns context with previous messages for rollback.
     * @async
     * @author Mike Odnis
     */
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: ['messages'] });

      const previousMessages = queryClient.getQueryData<ApiResponse>(['messages']);

      queryClient.setQueryData<ApiResponse>(['messages'], (old) => {
        if (!old) return { json: { json: [newMessage] } };
        return {
          json: {
            json: [newMessage, ...old.json.json],
          },
        };
      });

      return { previousMessages };
    },
    /**
     * Called if the mutation encounters an error, rolling back the optimistically updated cache.
     *
     * @param {Error} _err - The error thrown during mutation.
     * @param {Message} _newMessage - The message object being posted.
     * @param {MutationContext} context - Mutation context carrying previous messages state.
     * @returns {void}
     * @author Mike Odnis
     */
    onError: (_err, _newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData<ApiResponse>(['messages'], context.previousMessages);
      }
    },
    /**
     * Called once the mutation is either successful or encounters an error,
     * triggering invalidation and refetching of the messages cache.
     *
     * @returns {void}
     * @author Mike Odnis
     */
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
