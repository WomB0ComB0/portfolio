import Link from "next/link";
import Header from "../components/Header";
import Hero from "../components/Hero";
import About from "../components/About";
import WorkExperience from "../components/WorkExperience";
import Skills from "../components/Skills";
import Projects from "../components/Projects";
import ContactMe from "../components/ContactMe";
import {Analytics} from "@vercel/analytics/react"
export default function Home() {
  return (
    <>
      <div className=" bg-[rgb(36,36,36)] text-white h-screen snap-y snap-mandatory overflow-y-scroll overflow-x-hidden z-0 scrollbar scrollbar-track-gray-400/20 scrollbar-thumb-[#f7ab0a]/80">
        <Header />
        <section id="hero" className="snap-start">
          <Hero />
        </section>      
        <section id="about" className="snap-center">
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
        <Link href="#hero">
          <footer className="sticky w-full cursor-pointer bottom-5">
            <div className="flex items-center justify-center">
              <img 
              className="w-10 h-10 rounded-full cursor-pointer filter grayscale hover:grayscale-0"
              src="" alt="hi" />
            </div>
          </footer>
        </Link>
      </div>
      <Analytics />
    </>
  )
}
