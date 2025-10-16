
'use client';

import { post } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';

/**
 * @interface Message
 * @description
 * Represents a single message entity used within the messaging system of the portfolio project.
 * Used as both payload and response structure for message-related operations.
 * @property {string} id - The unique identifier of the message.
 * @property {string} message - The textual content of the message.
 * @property {string} authorName - Name of the message's author.
 * @property {string} createdAt - Date string representing message creation.
 * @property {string | null | undefined} [email] - Optional author email address.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @readonly
 * @see https://github.com/WomB0ComB0/portfolio
 */
interface Message {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
  email?: string | null;
}

/**
 * @interface ApiResponse
 * @description
 * Defines the structure of the response payload for the messages query API.
 * Useful for caching and querying messages in the client state.
 * @property {{ json: Message[] }} json - Nested object containing an array of Message objects.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
 * @public
 */
interface ApiResponse {
  json: {
    json: Message[];
  };
}

/**
 * @interface MutationContext
 * @description
 * Context structure passed between React Query mutation lifecycle events for message mutations.
 * Contains the previous cached messages, allowing for optimistic UI rollback.
 * @property {ApiResponse | undefined} previousMessages - The previously cached messages query data, or undefined.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
 * @private
 */
interface MutationContext {
  previousMessages: ApiResponse | undefined;
}

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

