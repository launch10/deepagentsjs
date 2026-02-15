import React from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Problem } from '@/components/Problem';
import { Features } from '@/components/Features';
import { SocialProof } from '@/components/SocialProof';
import { Pricing } from '@/components/Pricing';
import { FinalCTA } from '@/components/FinalCTA';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Problem />
      <Features />
      <SocialProof />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
};