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

'use client';

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { FiAlertCircle, FiClock, FiMessageSquare, FiSend, FiUser } from 'react-icons/fi';
import { toast } from 'sonner';
import { z } from 'zod';
import { LoginButton } from '@/components/custom/login-button';
import { LogoutButton } from '@/components/custom/logout-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth';
import { usePostMessage } from '@/hooks';
import { get } from '@/lib/http-clients/effect-fetcher';
import { formatDateTime, logger } from '@/utils';
import { escapeHtml, validateUserInput } from '@/utils/security/xss';

/**
 * Zod validation schema for input messages.
 */
const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(280, { message: 'Message must be less than 280 characters.' }),
});

/**
 * Represents a single guestbook message.
 */
interface Message {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
  email?: string | null;
}

/**
 * Guestbook API response wrapper.
 */
interface ApiResponse {
  json: Message[];
}

/**
 * Effect schema for a single message
 */
const MessageSchema = Schema.Struct({
  id: Schema.String,
  message: Schema.String,
  authorName: Schema.String,
  createdAt: Schema.String,
  email: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
});

/**
 * Effect schema for an array of guestbook messages
 */
const MessagesResponseSchema = Schema.Struct({
  json: Schema.Array(MessageSchema),
});

/**
 * Skeleton loader for individual message cards
 */
const MessageSkeleton = () => {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
      <div className="space-y-4">
        <Skeleton className="h-5 w-full bg-muted/50" />
        <Skeleton className="h-5 w-4/5 bg-muted/50" />
        <div className="flex justify-between items-center pt-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full bg-muted/50" />
            <Skeleton className="h-4 w-28 bg-muted/50" />
          </div>
          <Skeleton className="h-4 w-24 bg-muted/50" />
        </div>
      </div>
    </div>
  );
};

/**
 * Loading UI - renders skeleton state for messages
 */
function LoadingUI() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, index) => (
        <MessageSkeleton key={`loading-${index + 1}`} />
      ))}
    </div>
  );
}

/**
 * Error UI - displays error state with retry option
 */
function ErrorUI({ error }: { error: Error }) {
  return (
    <div className="text-center py-16 space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
        <FiAlertCircle className="text-4xl text-destructive" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Unable to Load Messages</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{error.message}</p>
      </div>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Try Again
      </Button>
    </div>
  );
}

/**
 * Main Guestbook Component
 * Handles authentication, message form, entry listing, loading and error states.
 */
export const GuestbookComponent = () => {
  const [message, setMessage] = useState('');
  const user = useCurrentUser();

  /**
   * Fetches guestbook messages from the API
   */
  const { data, error, isLoading } = useQuery<ApiResponse, Error>({
    queryKey: ['messages'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/v1/messages', {
          retries: 2,
          timeout: 10_000,
          schema: MessagesResponseSchema,
        }),
        Effect.provide(FetchHttpClient.layer),
      );
      const result = await Effect.runPromise(effect);
      return result as unknown as ApiResponse;
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });

  /**
   * Memoized guestbook messages list
   */
  const messages = useMemo(() => {
    return data?.json || [];
  }, [data]);

  /**
   * Custom mutation hook for posting messages
   */
  const postMessage = usePostMessage();

  /**
   * Handles message form submission with validation and sanitization
   */
  const handleSubmit = useCallback(async () => {
    const input = inputSchema.safeParse({ text: message.trim() });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message as string);
      return;
    }

    const sanitizedMessage = validateUserInput(input.data.text, 280, false);

    if (!sanitizedMessage || sanitizedMessage.length === 0) {
      toast.error('Message contains invalid content.');
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      message: sanitizedMessage,
      authorName: escapeHtml(user?.displayName || 'Anonymous'),
      createdAt: new Date().toISOString(),
      email: user?.email || null,
    };

    try {
      await postMessage.mutateAsync(newMessage);
      setMessage('');
      toast.success('Message sent successfully!');
    } catch (error) {
      logger.error('Error adding message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  }, [message, postMessage, user]);

  return (
    <section className="w-full min-h-full p-8 md:p-12 lg:p-16">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center space-y-4 pb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <FiMessageSquare className="text-3xl text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight">Guestbook</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Share your thoughts and connect with visitors from around the world
          </p>
        </header>

        {/* Authentication & Message Form */}
        {user ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-xl text-foreground">Share Your Thoughts</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Signed in as {user.displayName || 'Anonymous'}
                  </p>
                </div>
                <LogoutButton
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Sign out"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-6">
                <div className="relative">
                  <Textarea
                    className="w-full min-h-36 p-5 rounded-xl bg-background/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 border-border/50 resize-none text-base"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's on your mind?"
                    maxLength={280}
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-muted-foreground font-medium">
                    {message.length} / 280
                  </div>
                </div>
                <Button
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-xl transition-all duration-200 group"
                  onClick={handleSubmit}
                  disabled={postMessage.isPending || message.trim().length === 0}
                  aria-label="Send message"
                >
                  <FiSend className="mr-2 group-hover:translate-x-0.5 transition-transform" />
                  {postMessage.isPending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-xl">
            <CardContent className="py-16 px-8 space-y-8 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary/10">
                <FiUser className="text-4xl text-primary" />
              </div>
              <div className="space-y-3 max-w-md mx-auto">
                <h3 className="text-2xl font-semibold text-foreground">Welcome!</h3>
                <p className="text-muted-foreground text-base">
                  Sign in to leave a message and be part of the conversation
                </p>
              </div>
              <div className="flex gap-4 justify-center flex-wrap pt-4">
                <LoginButton signInMethod="google.com" />
                <LoginButton signInMethod="github.com" />
                <LoginButton signInMethod="anonymous" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-2xl font-semibold text-foreground">Recent Messages</h2>
            <span className="text-sm text-muted-foreground font-medium">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          <ScrollArea className="h-[600px] w-full pr-4">
            <div className="space-y-6">
              {isLoading ? (
                <LoadingUI />
              ) : error ? (
                <ErrorUI error={error} />
              ) : messages.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/50">
                    <FiMessageSquare className="text-3xl text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">No messages yet</p>
                    <p className="text-muted-foreground text-sm">
                      Be the first to leave a message!
                    </p>
                  </div>
                </div>
              ) : (
                <AnimatePresence>
                  {messages.map((msg: Message) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                      <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                        <CardContent className="p-6 space-y-5">
                          <p className="text-foreground text-base leading-relaxed">
                            {escapeHtml(msg.message)}
                          </p>
                          <div className="flex justify-between items-center text-sm pt-3 border-t border-border/30">
                            <div className="flex items-center gap-2.5 text-muted-foreground hover:text-primary transition-colors">
                              <FiUser className="h-4 w-4" />
                              <span className="font-medium">{escapeHtml(msg.authorName)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <FiClock className="h-4 w-4" />
                              <time className="text-sm">{formatDateTime(msg.createdAt)}</time>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </section>
  );
};
GuestbookComponent.displayName = 'GuestbookComponent';
export default GuestbookComponent;
