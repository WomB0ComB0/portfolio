import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

interface Message {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

export function useGetMessages() {
  return useQuery<Message[], Error>({
    queryKey: ['messages'],
    queryFn: async () => {
      const response = await fetch('/api/v1/messages');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      const text = await response.text();
      const { messages } = superjson.parse<{ messages: Message[] }>(text);
      return messages;
    },
  });
}

interface NewMessage {
  text: string;
  authorName: string;
}

export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, NewMessage>({
    mutationFn: async (newMessage) => {
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: superjson.stringify(newMessage),
      });
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      const text = await response.text();
      return superjson.parse(text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
