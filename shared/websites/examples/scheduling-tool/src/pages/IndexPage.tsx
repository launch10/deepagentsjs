import React from 'react';
import { Hero } from '@/components/Hero';
import { Problem } from '@/components/Problem';
import { Features } from '@/components/Features';
import { SocialProof } from '@/components/SocialProof';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export const IndexPage = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Problem />
      <Features />
      <SocialProof />
      <CTA />
      <Footer />
    </div>
  )
};