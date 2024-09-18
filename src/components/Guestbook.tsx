'use client';
import { auth, firestore } from '@/core/firebase';
import { GithubAuthProvider, GoogleAuthProvider, type User, signInWithPopup } from 'firebase/auth';
import { Timestamp, addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FiLogOut, FiSend } from 'react-icons/fi';
import { SiGithub, SiGoogle } from 'react-icons/si';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const inputSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message is empty!' })
    .max(100, { message: 'Message should not be more than 100 characters!' }),
});

type Message = {
  id: string;
  text: string;
  authorName: string;
  createdAt: Timestamp;
};

export default function GuestbookComponent() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(firestore, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[],
      );
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (provider: 'google' | 'github') => {
    try {
      const authProvider =
        provider === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
      await signInWithPopup(auth, authProvider);
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const id = toast.loading('Sending message...');
    const input = inputSchema.safeParse({ text: message.trim() });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message as string, { id });
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(firestore, 'messages'), {
        text: input.data.text,
        authorName: user?.displayName || 'Anonymous',
        createdAt: Timestamp.now(),
      });
      toast.success('Message sent!', { id });
      setMessage('');
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('Failed to send message. Please try again.', { id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full min-h-full h-full py-6 flex flex-col">
        {user ? (
          <div className="flex flex-col gap-4 dark:bg-zinc-800 bg-zinc-200 p-4 rounded-lg shadow-xl">
            <Textarea
              className="w-full h-32 p-2 rounded-md dark:bg-zinc-900 bg-zinc-100 dark:text-zinc-200 text-zinc-800 text-sm focus:border-none border-none ring-0"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex gap-4 justify-evenly items-center w-auto">
              <Button
                className="w-full px-6 py-2 rounded-md dark:bg-zinc-900 bg-zinc-100 dark:text-zinc-200 text-zinc-800 hover:shadow-xl duration-200"
                onClick={handleSubmit}
                disabled={loading}
              >
                <FiSend className="inline-block mr-2" />
                {loading ? 'Loading...' : 'Send It'}
              </Button>
              <Button
                className="w-full max-w-max px-6 py-2 rounded-md dark:bg-zinc-900 bg-zinc-100 dark:text-zinc-200 text-zinc-800 hover:shadow-xl duration-200"
                onClick={handleSignOut}
              >
                <FiLogOut className="inline-block mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-lg dark:bg-gradient-to-r dark:from-neutral-800 dark:to-zinc-800 bg-gradient-to-r from-neutral-200 to-zinc-200 p-4 gap-2 shadow-xl">
            <div>
              <h3 className="dark:text-zinc-200 text-zinc-800 m-0">Leave a Message 👇</h3>
              <p className="dark:text-zinc-300 text-zinc-700 m-0 text-sm">
                You need to be signed in to post a message.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="max-w-max rounded-lg dark:bg-zinc-900 bg-zinc-100 dark:text-zinc-100 text-zinc-900 py-2 px-6 hover:shadow-xl duration-200"
                onClick={() => handleSignIn('google')}
              >
                <SiGoogle className="inline-block mr-2" />
                Sign In with Google
              </Button>
              <Button
                className="max-w-max rounded-lg dark:bg-zinc-900 bg-zinc-100 dark:text-zinc-100 text-zinc-900 py-2 px-6 hover:shadow-xl duration-200"
                onClick={() => handleSignIn('github')}
              >
                <SiGithub className="inline-block mr-2" />
                Sign In with GitHub
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-col py-6">
          {messages.map((message) => (
            <div
              className="flex flex-col gap-2 dark:hover:bg-zinc-800/40 hover:bg-zinc-300/40 hover:shadow-xl duration-200 p-4 rounded-lg"
              key={message.id}
            >
              <p className="dark:text-zinc-200 text-zinc-800 text-sm lg:text-base md:text-base m-0 break-all">
                {message.text}
              </p>
              <div className="flex justify-start items-center gap-4 dark:text-zinc-400 text-zinc-700 text-xs">
                <p className="m-0">by {message.authorName}</p>•
                <p className="m-0">
                  on{' '}
                  {Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(message.createdAt.toDate())}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
