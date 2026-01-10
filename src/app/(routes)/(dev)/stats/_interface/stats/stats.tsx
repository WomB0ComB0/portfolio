'use client';

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

import {
  DevStats,
  Discord,
  GitHubStats,
  LeetCodeStats,
} from '@/app/(routes)/(dev)/stats/_components';
import { PageHeader } from '@/components';
import Layout from '@/components/layout/layout';
import { FiActivity } from 'react-icons/fi';

export const Stats = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="Live Development Statistics"
          description="A real-time look at my activity and project metrics"
          icon={<FiActivity />}
        />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-8">
            <GitHubStats />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <Discord />
            <DevStats />
            <LeetCodeStats />
          </div>
        </div>
      </div>
    </Layout>
  );
};

Stats.displayName = 'Stats';
export default Stats;
