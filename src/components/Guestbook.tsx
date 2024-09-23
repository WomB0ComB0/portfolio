'use client';
import { useCurrentUser } from '@/core/auth';
import { useGetMessages, usePostMessage } from '@/hooks/useMessages';
import { useState } from 'react';
import { FiMessageSquare, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { LoginButton } from './custom/login-button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AnimatePresence, motion } from 'framer-motion';

const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message is empty!' })
    .max(100, { message: 'Message should not be more than 100 characters!' }),
});

export default function GuestbookComponent() {
  const [message, setMessage] = useState('');
  const user = useCurrentUser();
  const { data: messages, isLoading: messagesLoading, error: messagesError } = useGetMessages();
  const postMessage = usePostMessage();

  const handleSubmit = async () => {
    const input = inputSchema.safeParse({ text: message.trim() });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message as string);
      return;
    }

    try {
      await postMessage.mutateAsync({
        text: input.data.text,
        authorName: user?.displayName || 'Anonymous',
      });
      toast.success('Message sent!');
      setMessage('');
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <section className="w-full min-h-full">
      <article className="space-y-6">
        {user ? (
          <div className="space-y-4">
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
            >
              <FiSend className="inline-block mr-2" />
              {postMessage.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        ) : (
          <Card className="bg-purple-800 text-white">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-lg font-semibold">Leave a Message 👇</h3>
              <p className="text-sm text-purple-200">
                You need to be signed in to post a message.
              </p>
              <div className="flex gap-2 flex-wrap">
                <LoginButton signInMethod="google.com" />
                <LoginButton signInMethod="github.com" />
                <LoginButton signInMethod="anonymous" />
              </div>
            </CardContent>
          </Card>
        )}
        <div className="space-y-4">
          {messagesLoading ? (
            <p className="text-purple-200">Loading messages...</p>
          ) : messagesError ? (
            <p className="text-red-400">Error loading messages: {messagesError.message}</p>
          ) : (
            <AnimatePresence>
              {messages?.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-purple-800 p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <p className="text-white text-sm lg:text-base break-words">{message.text}</p>
                  <div className="flex justify-between items-center mt-2 text-purple-300 text-xs">
                    <p>by {message.authorName}</p>
                    <p>{formatDate(message.createdAt)}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </article>
    </section>
  );
}
