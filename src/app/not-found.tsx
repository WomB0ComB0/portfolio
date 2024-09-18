'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

const NotFound = () => {
  const router = useRouter();

  return (
    <main
      className={`
        h-[100dvh] w-[100dvw] bg-[#F0F0F0] flex flex-col justify-center items-center
      `}
    >
      <div className="w-full max-w-2xl p-8 mx-4 bg-white rounded-lg shadow-lg">
        <article className="text-center">
          <h1 className="text-[#0257AC] text-9xl font-bold mb-4">404</h1>
          <h2 className="text-[#0257AC] text-3xl font-bold mb-4">Oops! Medical Term Not Found</h2>
          <p className="text-[#0257AC] text-lg mb-8">
            It seems you've searched for a term that's not in our MediGlossary database yet. Don't
            worry, medical knowledge is always expanding, and so are we. Let's get you back to the
            main page where you can look up other medical terms or suggest this one for addition.
          </p>
          <Button
            className="bg-[#0257AC] text-white hover:bg-[#0257AC]/90 transition-colors duration-200"
            onClick={() => router.push('/')}
          >
            Return to MediGlossary
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </article>
      </div>
      <>
        <img
          src="/assets/images/auth.png"
          alt="MediGlossary Logo"
          className="object-contain absolute inset-0 w-full h-full z-[-10] mx-auto my-auto max-w-[1440px] max-h-[900px] min-w-[1024px] min-h-[768px]"
          width={1440}
          height={900}
        />
      </>
    </main>
  );
};

export default NotFound;
