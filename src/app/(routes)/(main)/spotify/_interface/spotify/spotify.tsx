/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import { NowPlaying, TopArtists, TopTracks } from '@/app/(routes)/(main)/spotify/_components';
import Layout from '@/components/layout/layout';

/**
 * Spotify component.
 * Displays Spotify statistics including now playing, top artists, and top tracks.
 *
 * @returns {JSX.Element} The Spotify stats view.
 * @author Mike Odnis
 * @version 1.0.0
 */
export const Spotify = () => {
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
};
Spotify.displayName = 'Spotify';
export default Spotify;
