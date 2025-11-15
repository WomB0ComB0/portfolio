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

import { env } from '@/env';
import { getProjects } from '@/lib/sanity/api';
import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify Sanity configuration and data fetch
 * DELETE THIS AFTER DEBUGGING
 */
export async function GET() {
  try {
    const projects = await getProjects();

    return NextResponse.json({
      success: true,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasToken: !!env.SANITY_API_TOKEN,
        tokenLength: env.SANITY_API_TOKEN?.length ?? 0,
        projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
        dataset: env.NEXT_PUBLIC_SANITY_DATASET,
      },
      data: {
        projectCount: projects.length,
        firstProject: projects[0]
          ? {
              id: projects[0]._id,
              title: projects[0].title,
              category: projects[0].category,
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
