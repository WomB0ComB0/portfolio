import { firestore } from '@/core/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { createTRPCRouter, publicProcedure } from '../trpc';

const sampleCollection = collection(firestore, 'message');

export const messagesGET = createTRPCRouter({
  getSample: publicProcedure.query(async () => {
    const messages: Messages[] = [];
    await getDocs(sampleCollection).then((response) => {
      response.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          authorName: data.authorName,
          email: data.email,
          message: data.message,
          createdAt: data.createdAt,
        });
      });
    });
    return { messages };
  }),
});
