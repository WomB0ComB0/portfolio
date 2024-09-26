import { createCheckoutSession } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  try {
    const { priceId } = await req.json();
    const session = await createCheckoutSession(priceId);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
};
