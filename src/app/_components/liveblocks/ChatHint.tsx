'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ChatHint() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 10000); // Hide after 10 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 text-gray-100 p-4 rounded-lg shadow-lg max-w-xs z-50 border border-purple-400">
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Close hint"
      >
        <X size={16} />
      </button>
      <h2 className="font-bold mb-2 text-purple-300">Chat with Others!</h2>
      <p className="text-sm">
        Press <kbd className="px-2 py-1 rounded border border-purple-400 text-purple-200">/ </kbd>{' '}
        to start chatting,
        <kbd className="px-2 py-1 rounded border border-purple-400 text-purple-200 ml-1">
          Shift+E
        </kbd>{' '}
        for reactions, and
        <kbd className="px-2 py-1 rounded border border-purple-400 text-purple-200 ml-1">Esc</kbd>{' '}
        to exit.
      </p>
    </div>
  );
}
