'use client';

import type { NextPage } from 'next';
import React from 'react';

import { About, ContactMe, Footer, Hero, Loader, Projects, Skills, WorkExperience } from '@/components/index';

const MainPage: React.FC<NextPage> = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);
  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <main className="">
            <div className=" customScroll z-0 h-screen snap-y snap-mandatory overflow-x-hidden overflow-y-scroll scroll-smooth bg-[rgb(36,36,36)] text-white">
              <section id="hero" className="snap-start">
                <Hero />
              </section>
              <section id="about" className=" snap-center">
                <About />
              </section>
              <section id="experience" className="snap-center">
                <WorkExperience />
              </section>
              <section id="skills" className="snap-start">
                <Skills />
              </section>
              <section id="projects" className="snap-start">
                <Projects />
              </section>
              <section id="contact" className="snap-start">
                <ContactMe />
              </section>
            </div>
          </main>
          <Footer />
        </>
      )}
    </>
  );
};

export default MainPage;
