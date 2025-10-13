'use client';

export const Licenses = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Licenses</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p>Information about open source and third-party licenses.</p>
        <h2>Open Source Libraries</h2>
        <p>
          This project uses various open source libraries. Below is a list of the main dependencies
          and their licenses.
        </p>
        <h2>Attribution</h2>
        <p>
          We acknowledge and are grateful to the open source community for their contributions.
        </p>
      </div>
    </section>
  );
};
Licenses.displayName = 'Licenses';

export default Licenses;