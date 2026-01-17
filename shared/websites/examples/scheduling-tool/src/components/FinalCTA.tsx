import React, { useState } from 'react';
import { L10 } from '@/lib/tracking';
import { Rocket, CheckCircle2, ArrowRight } from 'lucide-react';

export function FinalCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      setStatus('error');
      return;
    }

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
    <section className="relative bg-primary text-primary-foreground py-20 md:py-24 lg:py-28 overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary/20 rounded-2xl mb-6">
            <Rocket className="w-8 h-8 text-secondary-foreground" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Join 2,000+ Teams Who've Ditched Scheduling Chaos
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl opacity-90 mb-8">
            Start your free trial today. No credit card required. Set up in under 5 minutes. Your team will thank you.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="bg-secondary/20 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-secondary-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">You're all set!</h3>
              <p className="opacity-90">
                Check your inbox for next steps. We'll have you up and running in minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50 transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="group bg-secondary text-secondary-foreground px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    'Starting...'
                  ) : (
                    <>
                      Start Free Trial
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {status === 'error' && errorMessage && (
                <p className="text-sm text-red-300 bg-red-500/20 px-4 py-2 rounded-lg">
                  {errorMessage}
                </p>
              )}

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-6 text-sm opacity-75 mt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>5-min setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
