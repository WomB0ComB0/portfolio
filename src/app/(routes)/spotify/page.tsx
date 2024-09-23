'use client';

import Footer from '@/components/layout/Footer';
import Layout from '@/components/layout/Layout';
import NowPlaying from '@/components/music/NowPlaying';
import TopArtists from '@/components/music/TopArtists';
import TopTracks from '@/components/music/TopTracks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SpotifyPage() {
  return (
    <Layout>
      <div className="w-full min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto mb-10">
          <h1 className="text-4xl font-bold mb-8">Spotify Stats</h1>
          <div className="space-y-8">
            <section>
              <NowPlaying />
            </section>

            <section>
              <Tabs defaultValue="artists" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#2a2a2a] rounded-lg p-1 mb-6">
                  <TabsTrigger
                    value="artists"
                    className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                  >
                    Top Artists
                  </TabsTrigger>
                  <TabsTrigger
                    value="tracks"
                    className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                  >
                    Top Tracks
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="artists">
                  <TopArtists />
                </TabsContent>
                <TabsContent value="tracks">
                  <TopTracks />
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </div>
        <Footer />
      </div>
    </Layout>
  );
}
