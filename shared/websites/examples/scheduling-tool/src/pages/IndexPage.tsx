import React from 'react';
import { Hero } from '@/components/Hero';
import { Problem } from '@/components/Problem';
import { Solution } from '@/components/Solution';
import { SocialProof } from '@/components/SocialProof';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Problem />
      <Solution />
      <SocialProof />
      <CTA />
      <Footer />
    </div>
  );
};