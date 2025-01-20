import { createCheckoutSession } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { priceId } = await request.json();
    console.log('Received priceId:', priceId);
    const session = await createCheckoutSession(priceId);
    console.log('Created session:', session.id);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error in checkout API route:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: (error as Error).message },
      { status: 500 },
    );
  }
}
