'use client';

export const Cookies = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Cookies Policy</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p>This page describes how cookies are used on this site.</p>
        <h2>What are cookies?</h2>
        <p>
          Cookies are small text files that are stored on your device when you visit a website.
        </p>
        <h2>How we use cookies</h2>
        <p>
          We use cookies to improve your experience, analyze site traffic, and personalize content.
        </p>
      </div>
    </section>
  );
};
Cookies.displayName = 'Cookies';
export default Cookies;