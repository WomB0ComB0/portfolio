import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

interface Message {
  id: string;
  authorName: string;
  email: string;
  message: string;
  createdAt: string;
}

interface User {
  email: string;
  password: string;
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

export function usePostMessage() {
  const queryClient = useQueryClient();

  return useMutation<{ user: User; id: string }, Error, User>({
    mutationFn: async (newUser) => {
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: superjson.stringify(newUser),
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
/**
 * gi-stats
 * lanyard
 * now-playing
 * top-artists
 * top-tracks
 * umami
 * wakatime
 */
