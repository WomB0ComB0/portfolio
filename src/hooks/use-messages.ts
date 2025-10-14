'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Effect, Schema, pipe } from 'effect';
import { FetchHttpClient } from '@effect/platform';
import { post } from '@/lib/http-clients/effect-fetcher';

interface Message {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
  email?: string | null;
}

interface ApiResponse {
  json: {
    json: Message[];
  };
}

interface MutationContext {
  previousMessages: ApiResponse | undefined;
}

// Schema for the message response
const MessageSchema = Schema.Struct({
  id: Schema.String,
  message: Schema.String,
  authorName: Schema.String,
  createdAt: Schema.String,
  email: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
});

export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, Message, MutationContext>({
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
    onError: (_err, _newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData<ApiResponse>(['messages'], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
