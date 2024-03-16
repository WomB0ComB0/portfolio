import { publicProcedure, router } from "../trpc";
import { firestore } from "@/core/firebase";
import { getDocs, collection } from "firebase/firestore";

let sampleCollection = collection(firestore, "message");

export const sampleGET = router({
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
