'use client';

export const Privacy = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p>Details about privacy and data handling on this site.</p>
        <h2>Information We Collect</h2>
        <p>
          We collect information that you provide directly to us, as well as information about your
          use of our services.
        </p>
        <h2>How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve our services.
        </p>
        <h2>Data Security</h2>
        <p>
          We implement appropriate security measures to protect your personal information.
        </p>
      </div>
    </section>
  );
};
Privacy.displayName = 'Privacy';

export default Privacy;