'use client';

import Layout from '@/components/layout/Layout';
import GoogleMaps from '@/components/markers/Map';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import places from '@/data/places';
import Link from 'next/link';
import { useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';

export default function PlacesPage() {
  const [_, setActivePlace] = useState(places[0]);

  return (
    <Layout>
      <div className="w-full min-h-screen p-4 md:p-8 text-[#ba9bdd]">
        <Card className="w-full max-w-4xl mx-auto bg-[#242424] border-[#560BAD] rounded-xl overflow-hidden">
          <CardHeader className="bg-[#2a2a2a] p-6">
            <div className="flex items-center gap-3 mb-2 sr-only">
              <FaInfoCircle className="text-3xl text-[#ba9bdd]" />
              <CardTitle className="text-3xl md:text-4xl font-bold text-[#ba9bdd]">
                My Places
              </CardTitle>
            </div>
            <CardDescription className="text-[#ba9bdd]/80 text-lg">
              Explore the locations I've visited, including hackathons, tech events, and notable
              places.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#2a2a2a] rounded-lg p-1 mb-6">
                <TabsTrigger
                  value="map"
                  className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                >
                  Map
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                >
                  Place List
                </TabsTrigger>
              </TabsList>
              <TabsContent value="map">
                <div className="w-full h-[500px] rounded-lg overflow-hidden">
                  <GoogleMaps />
                </div>
              </TabsContent>
              <TabsContent value="list">
                <ScrollArea className="h-[500px] w-full pr-4">
                  {places.map((place, index) => (
                    <Card
                      key={index}
                      className="mb-4 bg-[#2a2a2a] border-none cursor-pointer hover:bg-[#3a3a3a] transition-colors"
                      onClick={() => setActivePlace(place)}
                    >
                      <CardHeader>
                        <Link
                          href={`https://maps.google.com/?q=${place[2]},${place[3]}`}
                          target="_blank"
                          className="w-full h-full"
                          rel="noopener noreferrer"
                        >
                          <CardTitle className="text-xl text-[#ba9bdd]">{place[0]}</CardTitle>
                          <CardDescription className="text-[#ba9bdd]/70 text-base">
                            {place[1]}
                          </CardDescription>
                        </Link>
                      </CardHeader>
                    </Card>
                  ))}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
