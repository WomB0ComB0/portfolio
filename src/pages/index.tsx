import {  Hero, About, WorkExperience, Skills, Projects, ContactMe, Footer } from "@/components";
import RootLayout from "@/app/layout";
export default function Home() {
  return (
    <RootLayout>
      <main className="">
        <div className=" bg-[rgb(36,36,36)] text-white h-screen snap-y snap-mandatory overflow-y-scroll overflow-x-hidden z-0 scroll-smooth customScroll">
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
    </RootLayout>
  )
}