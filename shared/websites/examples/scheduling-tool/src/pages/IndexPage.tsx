import React from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Problem } from '@/components/Problem';
import { Features } from '@/components/Features';
import { SocialProof } from '@/components/SocialProof';
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
        <SocialProof />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};
