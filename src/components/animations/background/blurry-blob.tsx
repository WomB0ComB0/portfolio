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

import { cn } from '@/lib/utils';

interface BlobProps extends React.HTMLAttributes<HTMLDivElement> {
  firstBlobColor: string;
  secondBlobColor: string;
}

export const BlurryBlob = ({ className, firstBlobColor, secondBlobColor }: BlobProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="relative w-full h-full">
        <div
          className={cn(
            'absolute right-0 top-0 h-96 w-96 animate-blob rounded-full opacity-20 mix-blend-multiply filter blur-3xl',
            className,
            firstBlobColor,
          )}
        ></div>
        <div
          className={cn(
            'absolute right-32 top-32 h-96 w-96 animate-blob rounded-full opacity-20 mix-blend-multiply filter blur-3xl animation-delay-2000',
            className,
            secondBlobColor,
          )}
        ></div>
      </div>
    </div>
  );
};
BlurryBlob.displayName = 'BlurryBlob';
export default BlurryBlob;
