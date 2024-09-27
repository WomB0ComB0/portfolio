'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import { Check, Cloud, Code, Database, Loader2, Rocket, Star } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { toast } from 'sonner';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const tiers = [
  {
    name: 'Basic',
    priceId: 'price_1Q3MN2GAWrNI8qCuQ5OonWRY',
    amount: 50,
    icon: <Code className="w-8 h-8 text-blue-400" />,
    timeFrame: '1-3 hours',
    features: [
      'Frontend fixes and adjustments',
      'Minor feature implementations (e.g., simple form or button)',
      'Basic bug fixes (JavaScript, React, etc.)',
      'Basic code review and feedback',
      'Email support',
    ],
  },
  {
    name: 'Standard',
    priceId: 'price_1Q3MLtGAWrNI8qCuG26IGI5c',
    amount: 100,
    icon: <Rocket className="w-8 h-8 text-green-400" />,
    timeFrame: '3-6 hours',
    features: [
      'Full-stack development (frontend + simple backend integration)',
      'UI/UX enhancements',
      'Database setup (e.g., MySQL, MongoDB)',
      'Basic CI/CD pipeline setup (GitHub Actions, CircleCI)',
      'Priority email and chat support',
    ],
  },
  {
    name: 'Premium',
    priceId: 'price_1Q3MNMGAWrNI8qCuscYmFrKY',
    amount: 250,
    icon: <Database className="w-8 h-8 text-purple-400" />,
    timeFrame: '6-12 hours',
    features: [
      'Advanced full-stack development (React/Node, Next.js, etc.)',
      'Service integrations (e.g., AWS, Firebase, or 3rd-party APIs)',
      'Database optimization and scaling (PostgreSQL, MongoDB)',
      'Comprehensive testing with Jest, PyTest, etc.',
      'DevOps setup (Docker, CI/CD optimization)',
      'Weekly progress meetings',
      '24/7 support',
    ],
  },
  {
    name: 'Enterprise',
    priceId: 'price_1Q3MO7GAWrNI8qCuaDKV221Y',
    amount: 500,
    icon: <Cloud className="w-8 h-8 text-indigo-400" />,
    timeFrame: '12-24 hours',
    features: [
      'Custom solution architecture and development',
      'Cloud infrastructure (AWS, GCP, Kubernetes)',
      'AI/ML project integration (Llama API, LangChain)',
      'Performance optimization at scale',
      'Advanced DevOps (monitoring, Prometheus, Grafana)',
      'Comprehensive documentation and training',
      'Dedicated 24/7 support',
      'Bi-weekly strategy meetings',
    ],
  },
];

const PricingTier = ({
  tier,
  onCheckout,
  isLoading,
}: { tier: any; onCheckout: any; isLoading: any }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="h-full"
  >
    <Card className="flex flex-col h-full border-purple-300 bg-background">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-2">{tier.icon}</div>
        <CardTitle className="text-2xl font-bold">
          {tier.name}
          {tier.name === 'Premium' && <Star className="inline-block ml-2 text-yellow-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        <p className="text-4xl font-bold text-center mb-2">${tier.amount}</p>
        <p className="text-sm text-center mb-4 text-purple-300">{tier.timeFrame}</p>
        <ScrollArea className="h-[200px] w-full pr-4">
          <ul className="space-y-2 text-sm">
            {tier.features.map((feature: any, index: any) => (
              <li key={index} className="flex items-start">
                <Check className="mr-2 h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onCheckout(tier.priceId)}
          className="w-full text-lg py-4 bg-purple-600 hover:bg-purple-700 text-white"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isLoading ? 'Processing...' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  </motion.div>
);

export default function HirePage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (priceId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      const { error } = await stripe!.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe checkout error:', error);
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error('Failed to create checkout session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-center ">
            Hire Me for Your Next Project
          </h1>
          <p className="text-lg sm:text-xl text-center mb-12 max-w-3xl mx-auto">
            With expertise in web, mobile, desktop, cloud, and game development, I can bring your
            vision to life. Choose the plan that fits your project's scope and complexity.
          </p>
          <div className="grid gap-8 sm:grid-cols-2">
            {tiers.map((tier) => (
              <PricingTier
                key={tier.priceId}
                tier={tier}
                onCheckout={handleCheckout}
                isLoading={loading}
              />
            ))}
          </div>
          <p className="text-center mt-12 text-purple-200">
            Not sure which plan is right for you?{' '}
            <Link
              href="mailto:mikeodnis32420024@gmail.com"
              className="text-purple-400 hover:underline"
            >
              Contact me
            </Link>
            for a custom quote.
          </p>
        </div>
      </div>
    </Layout>
  );
}
