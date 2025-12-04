import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Problem } from '@/components/Problem';
import { Features } from '@/components/Features';
import { HowItWorks } from '@/components/HowItWorks';
import { Methodology } from '@/components/Methodology';
import { Testimonials } from '@/components/Testimonials';
import { Pricing } from '@/components/Pricing';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Methodology />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};
