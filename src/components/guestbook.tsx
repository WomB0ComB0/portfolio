'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentUser } from '@/core/auth';
import { usePostMessage } from '@/hooks/useMessages';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { FiAlertCircle, FiSend, FiMessageSquare } from 'react-icons/fi';
import { toast } from 'sonner';
import { z } from 'zod';
import { LoginButton } from './custom/login-button';
import { LogoutButton } from './custom/logout-button';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(280, { message: 'Message must be less than 280 characters.' }),
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
      toast.success('Message sent successfully!');
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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }, []);

  return (
    <section className="w-full min-h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-8 rounded-2xl shadow-2xl">
      <article className="space-y-8">
        <h1 className="text-4xl font-bold text-purple-300 text-center tracking-wider">
          Digital Guestbook
        </h1>

        {user ? (
          <Card className="bg-purple-900 bg-opacity-40 border-purple-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-purple-300">
                  Welcome, {user.displayName || 'Anonymous'}
                </CardTitle>
                <LogoutButton
                  className="text-purple-300 hover:text-white"
                  aria-label="Sign out"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  className="w-full h-32 p-3 rounded-md bg-purple-800 bg-opacity-50 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-400 border-purple-700"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Leave your mark..."
                />
                <Button
                  className="w-full px-6 py-3 bg-green-600 text-white font-bold hover:bg-green-500 focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-purple-900 transition-all duration-300"
                  onClick={handleSubmit}
                  disabled={postMessage.isPending}
                  aria-label="Send message"
                >
                  <FiSend className="inline-block mr-2" />
                  {postMessage.isPending ? 'Submitting...' : 'Submit Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-purple-900 bg-opacity-40 text-white border-purple-700">
            <CardContent className="p-6 space-y-4 text-center">
              <FiMessageSquare className="text-5xl text-purple-400 mx-auto" />
              <h3 className="text-xl font-semibold text-purple-300">Join the Conversation</h3>
              <p className="text-purple-200">Sign in to leave a message on the guestbook.</p>
              <div className="flex gap-4 justify-center flex-wrap">
                <LoginButton signInMethod="google.com" />
                <LoginButton signInMethod="github.com" />
                <LoginButton signInMethod="anonymous" />
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="h-[500px] w-full rounded-lg border border-purple-700 bg-purple-900 bg-opacity-20">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <LoadingUI />
            ) : error ? (
              <ErrorUI error={error} />
            ) : (
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-purple-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-purple-700 hover:border-purple-500 transition-all duration-300"
                  >
                    <p className="text-white text-base break-words mb-2">{msg.message}</p>
                    <div className="flex justify-between items-center text-purple-300 text-xs">
                      <p className="font-semibold">
                        {msg.authorName}
                      </p>
                      <p>{formatDate(msg.createdAt)}</p>
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
      {[...Array(5)].map((_, index) => (
        <Card key={`loading-${index + 1}`} className="bg-purple-800 bg-opacity-50 border-purple-700">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-4/5 bg-purple-700" />
            <Skeleton className="h-4 w-3/5 bg-purple-700" />
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
    <Card className="bg-red-900 bg-opacity-50 text-white border-red-700">
      <CardContent className="p-6 text-center">
        <FiAlertCircle className="text-5xl text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-red-300">Failed to Load Messages</h3>
        <p className="text-sm text-red-200 mb-4">{error.message}</p>
        <Button
          className="bg-red-600 hover:bg-red-500 text-white font-bold"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
