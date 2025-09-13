'use client';

import Layout from '@/components/layout/Layout';
import NowPlaying from '@/components/music/NowPlaying';
import TopArtists from '@/components/music/TopArtists';
import TopTracks from '@/components/music/TopTracks';

export default function SpotifyPage() {
  return (
    <Layout>
      <div className="w-full min-h-screen p-4 md:p-8">
        <div className="max-w-6xl mx-auto mb-10">
          <h1 className="text-4xl font-bold mb-8 text-center text-purple-300">My Spotify Stats</h1>
          <div className="space-y-12">
            <section>
              <NowPlaying />
            </section>
            <section>
              <TopArtists />
            </section>
            <section>
              <TopTracks />
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
