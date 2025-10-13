'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import superjson from 'superjson';
import { Stringify } from '@/utils';

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

export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, Message, MutationContext>({
    mutationFn: async (newMessage) => {
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Stringify(newMessage),
      });
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      const text = await response.text();
      return superjson.parse(text);
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
    onError: (err, newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData<ApiResponse>(['messages'], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
