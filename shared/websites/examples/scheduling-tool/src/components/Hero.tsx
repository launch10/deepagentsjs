import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Zap } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function Hero() {
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
    <section className="relative min-h-screen flex items-center justify-center bg-primary text-primary-foreground overflow-hidden pt-20">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#E9C46A]/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#F4A261]/20 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2A9D8F]/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Copy */}
          <div className="text-center lg:text-left space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E9C46A]/20 rounded-full text-sm font-medium text-[#E9C46A] backdrop-blur-sm">
              <Zap className="w-4 h-4" />
              <span>Join 2,000+ distributed teams</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight text-[#FAFAFA]">
              Stop Playing Calendar Tetris Across Time Zones
            </h1>

            <p className="text-lg md:text-xl text-[#E9C46A] max-w-2xl">
              The scheduling tool that instantly finds meeting times everyone can actually attend—no more endless Slack threads asking "when works for you?"
            </p>

            {/* Email capture form */}
            <div className="max-w-md mx-auto lg:mx-0">
              {status === 'success' ? (
                <div className="p-6 bg-[#2A9D8F]/20 border border-[#2A9D8F] rounded-2xl backdrop-blur-sm animate-zoom-in">
                  <p className="text-[#FAFAFA] font-semibold text-lg mb-2">🎉 You're on the list!</p>
                  <p className="text-[#E9C46A]">We'll send you an invite to start scheduling smarter.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Enter your work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 h-12 bg-background/90 backdrop-blur-sm border-[#E9C46A]/30 focus:border-[#E9C46A] text-foreground placeholder:text-muted-foreground"
                      disabled={status === 'loading'}
                      required
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 px-8 bg-[#E9C46A] text-[#0A0A0A] hover:bg-[#F4A261] hover:scale-105 transition-all duration-200 font-semibold"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? 'Starting...' : 'Start Scheduling Smarter'}
                    </Button>
                  </div>
                  {status === 'error' && (
                    <p className="text-sm text-[#E76F51]">{errorMessage}</p>
                  )}
                  <p className="text-sm text-[#E9C46A]/80">
                    Free 14-day trial • No credit card required • Setup in 2 minutes
                  </p>
                </form>
              )}
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4">
              <div className="flex items-center gap-2 text-[#E9C46A]">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium">Works with all calendars</span>
              </div>
              <div className="flex items-center gap-2 text-[#E9C46A]">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Smart time zone detection</span>
              </div>
            </div>
          </div>

          {/* Right column - Visual */}
          <div className="relative hidden lg:block animate-float">
            <div className="relative">
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Scheduling dashboard"
                className="w-full h-auto rounded-3xl shadow-2xl"
              />
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#E9C46A] rounded-2xl rotate-12 opacity-20 blur-xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-[#F4A261] rounded-2xl -rotate-12 opacity-20 blur-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-[#E9C46A]/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-[#E9C46A]/50 rounded-full" />
        </div>
      </div>
    </section>
  );
}
