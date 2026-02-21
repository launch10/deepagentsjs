import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { SocialProof } from "@/components/SocialProof";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export function IndexPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16 md:pt-20">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <SocialProof />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
