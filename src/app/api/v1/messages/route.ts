import { firestore } from '@/core/firebase';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import superjson from 'superjson';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: any; timestamp: number } | null = null;

const sampleCollection = collection(firestore, 'message');

export async function GET() {
  try {
    const currentTime = Date.now();
    if (cache && currentTime - cache.timestamp < CACHE_DURATION) {
      return new NextResponse(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    cache = { data: messages, timestamp: currentTime };

    return new NextResponse(superjson.stringify({ messages }), {
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
  const body = await request.text();
  const { authorName, email, message } = superjson.parse<{
    authorName: string;
    email: string;
    message: string;
  }>(body);
  const user = { authorName, email, message };
  const docRef = await addDoc(sampleCollection, user);
  return new NextResponse(superjson.stringify({ user, id: docRef.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
