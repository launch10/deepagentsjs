import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rocket, CalendarClock, Globe } from 'lucide-react';
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
    <section id="hero" className="relative min-h-screen flex items-center justify-center bg-primary text-primary-foreground overflow-hidden pt-20">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E9C46A]/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column - Copy */}
          <div className="text-center lg:text-left space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/20 rounded-full text-sm font-medium">
              <Rocket className="w-4 h-4" />
              <span>Join 2,000+ distributed teams</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight">
              Stop Playing{' '}
              <span className="text-[#E9C46A]">Calendar Tetris</span>{' '}
              Across Time Zones
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto lg:mx-0">
              The scheduling tool that instantly finds meeting times everyone can actually attend—no more endless Slack threads asking "when works for you?"
            </p>

            {/* Email capture form */}
            <div className="max-w-md mx-auto lg:mx-0">
              {status === 'success' ? (
                <div className="bg-success/20 border border-success/30 rounded-2xl p-6 text-center animate-zoom-in">
                  <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center mx-auto mb-3">
                    <Rocket className="w-6 h-6 text-success-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">You're on the list! 🎉</h3>
                  <p className="text-sm text-primary-foreground/80">Check your email to get started with your free trial.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Enter your work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 h-12 bg-background/95 border-background text-foreground placeholder:text-muted-foreground"
                      required
                      disabled={status === 'loading'}
                    />
                    <Button 
                      type="submit" 
                      size="lg"
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 transition-all h-12 px-8 font-semibold"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? 'Starting...' : 'Start Scheduling Smarter'}
                    </Button>
                  </div>
                  {status === 'error' && (
                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      {errorMessage}
                    </p>
                  )}
                  <p className="text-sm text-primary-foreground/70">
                    Free 14-day trial • No credit card required • Setup in 2 minutes
                  </p>
                </form>
              )}
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className="w-5 h-5 text-[#E9C46A]" />
                <span className="text-primary-foreground/80">80% less coordination time</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-5 h-5 text-[#E9C46A]" />
                <span className="text-primary-foreground/80">Works across all time zones</span>
              </div>
            </div>
          </div>

          {/* Right column - Visual */}
          <div className="relative lg:block animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="relative">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Scheduling dashboard"
                className="w-full h-auto rounded-3xl shadow-2xl"
              />
              {/* Floating elements */}
              <div className="absolute -top-6 -right-6 bg-card text-card-foreground rounded-2xl shadow-xl p-4 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center">
                    <CalendarClock className="w-5 h-5 text-success-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Time saved</p>
                    <p className="font-bold text-lg">15 hrs/week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
