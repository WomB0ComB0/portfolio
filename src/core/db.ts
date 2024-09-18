import { collection, onSnapshot } from 'firebase/firestore';
import { atom, useAtomValue } from 'jotai';
import { loadable } from 'jotai/utils';
import { firestore } from './firebase';

const messagesCollection = atom(
  (_get) => {
    const messages = collection(firestore, 'message');
    return new Promise((resolve) => {
      const unsubscribe = onSnapshot(messages, (snapshot) => {
        const messages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        resolve(messages);
      });

      return () => {
        unsubscribe();
      };
    });
  },
  (_get, set, update) => {
    set(messagesCollection, update);
  },
);

export const messagesCollectionAtom = atom(loadable(messagesCollection));
export const useMessagesCollection = () => useAtomValue(messagesCollectionAtom);
