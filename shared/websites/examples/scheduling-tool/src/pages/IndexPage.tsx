import React from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ProblemSection } from '@/components/ProblemSection';
import { SolutionSection } from '@/components/SolutionSection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { SocialProofSection } from '@/components/SocialProofSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <SocialProofSection />
      <CTASection />
      <Footer />
    </div>
  );
};