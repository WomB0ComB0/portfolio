'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentUser } from '@/core/auth';
import { usePostMessage } from '@/hooks/useMessages';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { FiAlertCircle, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';
import { z } from 'zod';
import { LoginButton } from './custom/login-button';
import { LogoutButton } from './custom/logout-button';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message is empty!' })
    .max(100, { message: 'Message should not be more than 100 characters!' }),
});

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

export default function GuestbookComponent() {
  const [message, setMessage] = useState('');
  const user = useCurrentUser();

  const { data, error, isLoading } = useQuery<ApiResponse, Error>({
    queryKey: ['messages'],
    queryFn: () => fetcher<ApiResponse>('/api/v1/messages'),
    staleTime: 60000,
    refetchInterval: 300000,
  });

  const messages = useMemo(() => {
    return data?.json?.json || [];
  }, [data]);

  const postMessage = usePostMessage();

  const handleSubmit = useCallback(async () => {
    const input = inputSchema.safeParse({ text: message.trim() });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message as string);
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      message: input.data.text,
      authorName: user?.displayName || 'Anonymous',
      createdAt: new Date().toISOString(),
      email: user?.email || null,
    };

    try {
      await postMessage.mutateAsync(newMessage);
      setMessage('');
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  }, [message, postMessage, user]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }, []);

  return (
    <section className="w-full min-h-full">
      <article className="space-y-6">
        {user ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-white">Welcome, {user.displayName || 'Anonymous'}</p>
              <LogoutButton className="text-white hover:text-purple-300" aria-label="Sign out" />
            </div>
            <Textarea
              className="w-full h-32 p-2 rounded-md bg-purple-800 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a message..."
            />
            <Button
              className="w-full px-6 py-2 bg-purple-600 text-white hover:bg-purple-500 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-purple-800"
              onClick={handleSubmit}
              disabled={postMessage.isPending}
              aria-label="Send message"
            >
              <FiSend className="inline-block mr-2" />
              {postMessage.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        ) : (
          <Card className="bg-purple-800 text-white">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-lg font-semibold text-[#ba9bdd]">Leave a Message 👇</h3>
              <p className="text-sm text-purple-200">You need to be signed in to post a message.</p>
              <div className="flex gap-2 flex-wrap">
                <LoginButton signInMethod="google.com" />
                <LoginButton signInMethod="github.com" />
                <LoginButton signInMethod="anonymous" />
              </div>
            </CardContent>
          </Card>
        )}
        <ScrollArea className="h-[400px] w-full rounded-md border border-purple-700">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <LoadingUI />
            ) : error ? (
              <ErrorUI error={error} />
            ) : (
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-purple-800 p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <p className="text-white text-sm lg:text-base break-words">{message.message}</p>
                    <div className="flex justify-between items-center mt-2 text-purple-300 text-xs">
                      <p>by {message.authorName}</p>
                      <p>{formatDate(message.createdAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </article>
    </section>
  );
}

function LoadingUI() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, index) => (
        <Card key={`loading-${index + 1}`} className="bg-purple-800">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4 bg-purple-700" />
            <Skeleton className="h-4 w-1/2 bg-purple-700" />
            <div className="flex justify-between items-center mt-2">
              <Skeleton className="h-3 w-1/4 bg-purple-700" />
              <Skeleton className="h-3 w-1/4 bg-purple-700" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorUI({ error }: { error: Error }) {
  return (
    <Card className="bg-red-800 text-white">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center space-x-2">
          <FiAlertCircle className="text-2xl" />
          <h3 className="text-lg font-semibold">Error loading messages</h3>
        </div>
        <p className="text-sm text-red-200">{error.message}</p>
        <Button
          className="mt-2 bg-red-600 hover:bg-red-500"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
