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

import Image from 'next/image';
import type React from 'react';
import Particles from '../magicui/particles';

export const Loader: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center h-screen bg-[rgb(36,36,36)] text-white">
      <Particles
        className="absolute inset-0 z-0"
        quantity={100}
        ease={80}
        color={'#ba9bdd'}
        refresh={false}
      />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="loader" />
          <Image
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 select-none h-60 w-60 animate-pulse"
            src="/assets/svgs/logo-client.svg"
            alt="Loading..."
            width={100}
            height={100}
          />
        </div>
      </div>
      <style jsx>{`
        .loader {
          width: 400px;
          height: 400px;
          border-radius: 50%;
          position: relative;
          background: conic-gradient(#ba9bdd, purple);
          animation: 2s rotate linear infinite;
          border: 5px solid #242424;
          transition: 0.5s;
        }
        .loader:before {
          position: absolute;
          content: "";
          width: calc(100% - 5px);
          height: calc(100% - 5px);
          background: #242424;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
        }
        .loader:after {
          position: absolute;
          content: "";
          z-index: -1;
          width: calc(100% + 10px);
          height: calc(100% + 10px);
          background: inherit;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          filter: blur(25px);
          border-radius: 50%;
        }
        @media only screen and (max-width: 600px) {
          .loader {
            width: 300px;
            height: 300px;
          }
        }
        @media only screen and (min-width: 600px) {
          .loader {
            width: 350px;
            height: 350px;
          }
        }
        @media only screen and (min-width: 768px) {
          .loader {
            width: 400px;
            height: 400px;
          }
        }
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
Loader.displayName = 'Loader';
export default Loader;
