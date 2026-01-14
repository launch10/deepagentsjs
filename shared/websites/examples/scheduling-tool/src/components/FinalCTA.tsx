import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rocket, Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function FinalCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section id="cta-form" className="py-20 md:py-24 lg:py-32 bg-primary text-primary-foreground relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#E9C46A] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#F4A261] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E9C46A]/20 rounded-full text-sm font-medium text-[#E9C46A] backdrop-blur-sm mb-8 animate-bounce">
            <Rocket className="w-4 h-4" />
            <span>Limited time: Get started free</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-[#FAFAFA] animate-fade-in">
            Stop Wasting Time on Scheduling. Start in 2 Minutes.
          </h2>

          <p className="text-lg md:text-xl text-[#E9C46A] mb-12 max-w-2xl mx-auto">
            Join the 2,000+ distributed teams who've already eliminated the back-and-forth. Your first perfectly scheduled meeting is 2 minutes away.
          </p>

          {status === 'success' ? (
            <div className="max-w-md mx-auto p-8 bg-[#2A9D8F]/20 border-2 border-[#2A9D8F] rounded-3xl backdrop-blur-sm animate-zoom-in">
              <div className="w-16 h-16 bg-[#2A9D8F] rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <p className="text-[#FAFAFA] font-bold text-xl mb-2">Welcome aboard! 🎉</p>
              <p className="text-[#E9C46A]">Check your inbox for next steps to start scheduling smarter.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4 animate-slide-up">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-14 bg-background/90 backdrop-blur-sm border-[#E9C46A]/30 focus:border-[#E9C46A] text-foreground placeholder:text-muted-foreground text-lg"
                  disabled={status === 'loading'}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 px-8 bg-[#E9C46A] text-[#0A0A0A] hover:bg-[#F4A261] hover:scale-105 transition-all duration-200 font-bold text-lg"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Processing...' : 'Get Started Free'}
                </Button>
              </div>
              {status === 'error' && (
                <p className="text-sm text-[#E76F51] bg-[#E76F51]/10 px-4 py-2 rounded-lg">{errorMessage}</p>
              )}
              <p className="text-sm text-[#E9C46A]/80">
                14-day free trial • No credit card required • Cancel anytime
              </p>
            </form>
          )}

          {/* Trust signals */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-[#E9C46A]/80">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">Free 14-day trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">No credit card needed</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">Setup in 2 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
