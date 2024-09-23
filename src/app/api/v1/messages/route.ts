import { firestore } from '@/core/firebase';
import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import superjson from 'superjson';

const CACHE_DURATION = 60 * 1000; // 1 minute
let cache: { data: any; timestamp: number } | null = null;

const messageCollection = collection(firestore, 'message');

export async function GET() {
  try {
    const currentTime = Date.now();
    if (cache && currentTime - cache.timestamp < CACHE_DURATION) {
      return new NextResponse(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messagesQuery = query(messageCollection, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(messagesQuery);

    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const response = { json: messages };
    cache = { data: response, timestamp: currentTime };

    return new NextResponse(superjson.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(superjson.stringify({ error: 'Failed to fetch messages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const parsedBody = superjson.parse<{ authorName: string; message: string }>(body);

    const { authorName, message } = parsedBody;

    if (!message) {
      throw new Error('Message is undefined');
    }

    const newMessage = { authorName, message, createdAt: new Date().toISOString() };
    const docRef = await addDoc(messageCollection, newMessage);

    cache = null; // Invalidate the cache

    return new NextResponse(superjson.stringify({ id: docRef.id, ...newMessage }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return new NextResponse(superjson.stringify({ error: 'Failed to add message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
