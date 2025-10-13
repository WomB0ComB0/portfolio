import { collection, type DocumentData, onSnapshot } from 'firebase/firestore';
import { atom, useAtomValue } from 'jotai';
import { loadable } from 'jotai/utils';
import { atomEffect } from 'jotai-effect';
import type { Message } from '../schema/message';
import { firestore } from './firebase';

// Internal atom to hold the messages state
const messagesValue = atom<Message[]>([]);

// Effect atom to set up real-time listener
const messagesListener = atomEffect((_get, set) => {
  const messagesRef = collection(firestore, 'message');

  const unsubscribe = onSnapshot(
    messagesRef,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          content: data.content as string,
          createdAt: data.createdAt as string,
          updatedAt: data.updatedAt as string,
        } satisfies Message;
      });
      set(messagesValue, messages);
    },
    (error) => {
      console.error('Error fetching messages:', error);
      set(messagesValue, []);
    },
  );

  return unsubscribe;
});

// Async atom that returns messages with listener attached
const messagesCollection = atom(async (get) => {
  get(messagesListener);
  return get(messagesValue);
});

export const messagesCollectionAtom = loadable(messagesCollection);
export const useMessagesCollection = () => useAtomValue(messagesCollectionAtom);
