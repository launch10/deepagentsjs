import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
    <section className="relative bg-primary py-24 md:py-32 overflow-hidden">
      {/* Animated gradient background effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Reclaim Your Time?
          </h2>

          {/* Subheadline */}
          <p className="text-xl text-primary-foreground/90 mb-12">
            Join 2,000+ teams who've eliminated scheduling chaos. Start free in 60 seconds.
          </p>

          {/* Form */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-secondary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-primary-foreground mb-2">
                You're on the list!
              </h3>
              <p className="text-primary-foreground/80">
                Check your inbox for next steps. We'll have you up and running in no time.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 text-lg rounded-xl bg-primary-foreground/95 text-primary border-2 border-transparent focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-secondary text-secondary-foreground text-lg font-semibold px-8 py-4 rounded-xl hover:scale-105 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    'Starting...'
                  ) : (
                    <>
                      Get Started Free
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {status === 'error' && (
                <p className="text-primary-foreground/90 mt-4 text-sm bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-lg px-4 py-2 inline-block">
                  {errorMessage}
                </p>
              )}
            </form>
          )}

          {/* Secondary text */}
          <p className="text-primary-foreground/70 text-sm">
            No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
