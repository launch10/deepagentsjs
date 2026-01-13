import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rocket, Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTASection() {
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
    <section id="cta" className="py-16 md:py-20 lg:py-24 bg-primary text-primary-foreground relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <Rocket className="w-4 h-4" />
            <span>Ready to reclaim your time?</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-6xl font-bold mb-6 animate-slide-up">
            Stop Wasting Time on Scheduling.{' '}
            <span className="text-[#E9C46A]">Start in 2 Minutes.</span>
          </h2>

          <p className="text-lg md:text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Join the 2,000+ distributed teams who've already eliminated the back-and-forth. Your first perfectly scheduled meeting is 2 minutes away.
          </p>

          {/* Email capture form */}
          <div className="max-w-xl mx-auto mb-8 animate-zoom-in" style={{ animationDelay: '0.2s' }}>
            {status === 'success' ? (
              <div className="bg-success/20 border border-success/30 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-success-foreground" />
                </div>
                <h3 className="font-semibold text-2xl mb-3">Welcome aboard! 🚀</h3>
                <p className="text-primary-foreground/80">
                  Check your email to start your free 14-day trial. No credit card required.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-14 bg-background/95 border-background text-foreground placeholder:text-muted-foreground text-lg"
                    required
                    disabled={status === 'loading'}
                  />
                  <Button 
                    type="submit" 
                    size="lg"
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 transition-all h-14 px-10 font-semibold text-lg"
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Starting...' : 'Get Started Free'}
                  </Button>
                </div>
                {status === 'error' && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    {errorMessage}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/80 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#E9C46A]" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#E9C46A]" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#E9C46A]" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
