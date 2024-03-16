import { atom, useAtomValue } from "jotai";
import { atomEffect } from "jotai-effect";
import { loadable } from "jotai/utils";
import { firestore } from './firebase'
import { collection } from "firebase/firestore";

const messagesCollection = atomEffect((_get, set) => {
  const messages = collection('message');
  const unsubscribe = messages.onSnapshot((snapshot) => {
    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });
    set(messagesCollection, messages);
  });

  return () => {
    unsubscribe();
  };
})

export const messagesCollectionAtom = atom(loadable(messagesCollection));
export const useMessagesCollection = () => useAtomValue(messagesCollectionAtom);
