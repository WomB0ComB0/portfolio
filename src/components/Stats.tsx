'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQueries } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { atom, useAtom } from 'jotai';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiCalendar, FiClock, FiExternalLink, FiEye } from 'react-icons/fi';
import { MagicCard } from './magicui';

interface StatCard {
  title: string;
  link: string;
  query: string;
}

interface GoogleData {
  json: {
    total_pageviews: number;
  };
}

interface WakaTimeData {
  json: {
    total_seconds: number;
    text: string;
    decimal: string;
    digital: string;
    daily_average: number;
    is_up_to_date: boolean;
    percent_calculated: number;
    range: {
      start: string;
      start_date: string;
      start_text: string;
      end: string;
      end_date: string;
      end_text: string;
      timezone: string;
    };
    timeout: number;
  };
}

const statCards: StatCard[] = [
  {
    title: 'Age',
    link: 'https://mikeodnis.dev/about',
    query: 'age',
  },
  {
    title: 'Views',
    link: '',
    query: 'google',
  },
  {
    title: 'Hours Coded',
    link: 'https://wakatime.com/@',
    query: 'wakatime',
  },
];

const googleDataAtom = atom<GoogleData | null>(null);
const wakatimeDataAtom = atom<WakaTimeData | null>(null);

export default function Stats() {
  const [age, setAge] = useState('');
  const [googleData, setGoogleData] = useAtom(googleDataAtom);
  const [wakatimeData, setWakatimeData] = useAtom(wakatimeDataAtom);

  const queries = useQueries({
    queries: [
      {
        queryKey: ['google'],
        queryFn: () => fetcher<string>('/api/v1/google'),
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ['wakatime'],
        queryFn: () => fetcher<string>('/api/v1/wakatime'),
        staleTime: 1000 * 60 * 60,
      },
    ],
  });

  useEffect(() => {
    const calculateAge = () => {
      const diff =
        (new Date().getTime() - new Date('March 24, 2004').getTime()) / (1000 * 60 * 60 * 24 * 365);
      return diff.toFixed(5);
    };

    const interval = setInterval(() => {
      const calculatedAge = calculateAge();
      setAge(calculatedAge);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (queries[0].data) {
      const parsedGoogleData: GoogleData = JSON.parse(queries[0].data);
      setGoogleData(parsedGoogleData);
    }
    if (queries[1].data) {
      const parsedWakatimeData: WakaTimeData = JSON.parse(queries[1].data);
      setWakatimeData(parsedWakatimeData);
    }
  }, [queries, setGoogleData, setWakatimeData]);

  const isLoading = queries.some((query) => query.isLoading);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <Card
            key={`${card.title}-${index}-skeleton`}
            className="overflow-hidden h-full shadow-lg bg-gradient-to-br from-purple-600 to-indigo-700"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getCardValue = (card: StatCard) => {
    switch (card.query) {
      case 'age':
        return age;
      case 'google':
        return googleData?.json.total_pageviews ?? 'N/A';
      case 'wakatime':
        return wakatimeData?.json.total_seconds
          ? Math.round(wakatimeData.json.total_seconds / 3600)
          : undefined;
      default:
        return undefined;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {statCards.map((card, index) => {
        const value = getCardValue(card);
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
              <CardHeader>
                <CardTitle
                  className={`${card.title === 'Site Views' ? 'text-white' : 'text-gray-300'}`}
                >
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {card.query === 'age' && <FiCalendar className="h-4 w-4" />}
                  {card.query === 'google' && <FiEye className="h-4 w-4" />}
                  {card.query === 'wakatime' && <FiClock className="h-4 w-4" />}
                  <AnimatePresence>
                    <span className="text-2xl font-bold">{value ?? '-'}</span>
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}