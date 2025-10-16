
'use client';

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
import { logger } from '@/utils';
import { escapeHtml, validateUserInput } from '@/utils/security/xss';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { FiAlertCircle, FiMessageSquare, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';
import { z } from 'zod';

/**
 * Zod validation schema for input messages.
 * Messages must be [1, 280] chars.
 * @readonly
 * @type {z.ZodObject<{ text: z.ZodString }>}
 * @private
 */
const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(280, { message: 'Message must be less than 280 characters.' }),
});

/**
 * Represents a single guestbook message.
 * @interface Message
 * @property {string} id - Unique identifier for the message.
 * @property {string} message - The content of the message.
 * @property {string} authorName - Name of the author.
 * @property {string} createdAt - ISO string of creation date.
 * @property {string | null | undefined} [email] - Optional email of the author.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
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
 * @interface ApiResponse
 * @property {Message[]} json - An array of Message objects.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
 */
interface ApiResponse {
  json: Message[];
}

/**
 * Effect schema for a single message (internal use).
 * @readonly
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
 * Effect schema for an array of guestbook messages (internal use).
 * @readonly
 * @private
 */
const MessagesResponseSchema = Schema.Struct({
  json: Schema.Array(MessageSchema),
});

/**
 * GuestbookComponent
 *
 * Main UI and logic for the digital guestbook in the portfolio project.
 * Handles authentication, message form, entry listing, loading and error states.
 * Uses effect-fetcher and React Query for async data access.
 * Messages are sanitized and validated before posting.
 *
 * @function
 * @returns {JSX.Element} Main digital guestbook section.
 * @throws {Error} Will throw if fetching messages or posting fails critically.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 * <GuestbookComponent />
 */
export default function GuestbookComponent() {
  const [message, setMessage] = useState('');
  const user = useCurrentUser();

  /**
   * Fetches guestbook messages from the API using react-query.
   * @type {import('@tanstack/react-query').UseQueryResult<ApiResponse, Error>}
   * @readonly
   */
  const { data, error, isLoading } = useQuery<ApiResponse, Error>({
    queryKey: ['messages'],
    /**
     * Asynchronous query function to fetch all messages.
     * Uses typed effect-based fetcher with schema and error handling.
     * @async
     * @returns {Promise<ApiResponse>}
     * @throws {Error} If fetching or validation fails.
     * @private
     */
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
      // Cast readonly types to mutable for React Query compatibility
      return result as unknown as ApiResponse;
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });

  /**
   * Memoized guestbook messages list from the fetched API response.
   * Returns an empty list if data is not loaded.
   * @type {Message[]}
   * @readonly
   */
  const messages = useMemo(() => {
    return data?.json || [];
  }, [data]);

  /**
   * Custom mutation hook for posting a new guestbook message.
   * @readonly
   */
  const postMessage = usePostMessage();

  /**
   * Handles message form submission.
   * Sanitizes and validates user input before posting to API.
   *
   * @function
   * @async
   * @throws {Error} If posting message fails.
   * @returns {Promise<void>}
   * @web
   * @private
   * @example
   * await handleSubmit();
   * @author Mike Odnis
   * @version 1.0.0
   */
  const handleSubmit = useCallback(async () => {
    const input = inputSchema.safeParse({ text: message.trim() });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message as string);
      return;
    }

    // Sanitize the message to prevent XSS attacks
    const sanitizedMessage = validateUserInput(input.data.text, 280, false);

    // Additional validation after sanitization
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

  /**
   * Formats a date string (ISO) into a human-readable string.
   * Returns 'Invalid date' if provided string is not a valid date.
   *
   * @function
   * @param {string} dateString - The ISO date string to format.
   * @returns {string} Formatted, human-readable date.
   * @readonly
   * @example
   * formatDate("2023-01-01T12:34:56.000Z"); // Jan 1, 2023, 12:34 PM
   * @web
   * @private
   */
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
                <LogoutButton className="text-purple-300 hover:text-white" aria-label="Sign out" />
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
                {messages.map((msg: Message) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-purple-800 bg-opacity-50 p-4 rounded-lg shadow-lg border border-purple-700 hover:border-purple-500 transition-all duration-300"
                  >
                    <p className="text-white text-base break-words mb-2">
                      {escapeHtml(msg.message)}
                    </p>
                    <div className="flex justify-between items-center text-purple-300 text-xs">
                      <p className="font-semibold">{escapeHtml(msg.authorName)}</p>
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

/**
 * LoadingUI
 *
 * Renders a loading skeleton state for guestbook messages.
 * Used while the guestbook message data is loading.
 *
 * @function
 * @returns {JSX.Element} Loading skeleton cards visually indicating data loading.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see GuestbookComponent
 * @version 1.0.0
 */
function LoadingUI() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <Card
          key={`loading-${index + 1}`}
          className="bg-purple-800 bg-opacity-50 border-purple-700"
        >
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

/**
 * ErrorUI
 *
 * Renders a user interface to display errors in fetching or posting messages.
 * Shows a retry button and error message.
 *
 * @function
 * @param {{ error: Error }} props - Error prop containing message to display.
 * @returns {JSX.Element} Error card UI with retry behavior.
 * @throws {Error} May throw on reload depending on browser or context.
 * @web
 * @public
 * @see GuestbookComponent
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * <ErrorUI error={new Error("Something went wrong")} />
 */
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
