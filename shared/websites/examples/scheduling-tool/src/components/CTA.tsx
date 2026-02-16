import { useState } from 'react';
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setError('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative bg-primary py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[32rem] h-[32rem] bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Sparkle icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 mb-6 md:mb-8">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-4 md:mb-6">
            Ready to Stop the Scheduling Madness?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 mb-8 md:mb-10 lg:mb-12 max-w-3xl mx-auto">
            Join 2,000+ teams who've reclaimed their time. Start coordinating meetings in seconds, not hours.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="inline-flex items-center gap-3 px-8 py-6 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
              <CheckCircle className="w-6 h-6 text-primary-foreground" />
              <div className="text-left">
                <p className="text-lg font-semibold text-primary-foreground">You're all set!</p>
                <p className="text-sm text-primary-foreground/80">Check your email to get started.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-xl mx-auto mb-6">
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground text-primary placeholder:text-primary/50 text-lg focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 disabled:opacity-50 shadow-lg"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="group px-8 py-4 rounded-xl bg-primary-foreground text-primary font-semibold text-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    'Starting...'
                  ) : (
                    <>
                      Get Started Free
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
              {error && (
                <p className="text-primary-foreground/90 text-sm mt-3 bg-primary-foreground/10 px-4 py-2 rounded-lg">
                  {error}
                </p>
              )}
            </form>
          )}

          {/* Secondary text */}
          {status !== 'success' && (
            <p className="text-primary-foreground/70 text-sm md:text-base">
              No credit card required • 14-day free trial
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
