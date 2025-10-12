import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { firestore } from '@/core/firebase';

export interface MessageData {
  authorName: string;
  message: string;
  createdAt: string;
}

export interface Message extends MessageData {
  id: string;
}

export interface MessagesResponse {
  json: Message[];
}

const CACHE_DURATION = 60 * 1000; // 1 minute
let cache: { data: MessagesResponse; timestamp: number } | null = null;

const messageCollection = collection(firestore, 'message');

export async function fetchMessages(): Promise<MessagesResponse> {
  const currentTime = Date.now();
  if (cache && currentTime - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const messagesQuery = query(messageCollection, orderBy('createdAt', 'desc'), limit(50));
  const snapshot = await getDocs(messagesQuery);

  const messages: Message[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      authorName: data.authorName,
      message: data.message,
      createdAt: data.createdAt,
    };
  });

  const result: MessagesResponse = { json: messages };

  cache = { data: result, timestamp: Date.now() };

  return result;
}

export async function createMessage(data: {
  authorName: string;
  message: string;
}): Promise<Message> {
  const { authorName, message } = data;

  if (!message) {
    throw new Error('Message is undefined');
  }

  const newMessage = { authorName, message, createdAt: new Date().toISOString() };
  const docRef = await addDoc(messageCollection, newMessage);

  const addedMessage: Message = {
    id: docRef.id,
    ...newMessage,
  };

  return addedMessage;
}
