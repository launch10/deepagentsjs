import { useState } from 'react';
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTA() {
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
    <section className="relative bg-primary py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient orb - top left */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />
        
        {/* Medium gradient orb - bottom right */}
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-primary-foreground/15 rounded-full blur-3xl" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Sparkle accents */}
        <div className="absolute top-20 left-1/4 opacity-40">
          <Sparkles className="w-6 h-6 text-primary-foreground animate-pulse" />
        </div>
        <div className="absolute bottom-32 right-1/3 opacity-30">
          <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Reclaim Your Time?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of teams who've said goodbye to scheduling chaos. Get early access today.
          </p>

          {/* Form or Success State */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 md:p-12 max-w-xl mx-auto">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
                You're on the list!
              </h3>
              <p className="text-primary-foreground/80 text-lg">
                Check your inbox for next steps. We'll be in touch soon with your early access details.
              </p>
            </div>
          ) : (
            <div className="max-w-xl mx-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email input and button */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={status === 'loading'}
                    className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground/95 text-primary placeholder:text-primary/50 text-lg focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="px-8 py-4 bg-primary-foreground text-primary rounded-xl font-semibold text-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {status === 'loading' ? (
                      'Submitting...'
                    ) : (
                      <>
                        Start Scheduling Smarter
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Error message */}
                {status === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-200">
                    {errorMessage}
                  </div>
                )}
              </form>

              {/* Supporting text */}
              <p className="text-primary-foreground/70 text-sm md:text-base mt-6">
                No credit card required • 14-day free trial
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
