import { Hero } from '@/components/Hero';
import { ProblemSolution } from '@/components/ProblemSolution';
import { Features } from '@/components/Features';
import { SocialProof } from '@/components/SocialProof';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <ProblemSolution />
      <Features />
      <SocialProof />
      <CTA />
      <Footer />
    </div>
  );
};