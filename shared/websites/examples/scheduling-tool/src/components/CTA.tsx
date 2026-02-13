import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTA() {
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
    <section className="relative bg-primary py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Reclaim Your Time?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-10 md:mb-12 max-w-2xl mx-auto">
            Join 2,000+ teams who've eliminated scheduling chaos. Get early access today.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 md:p-10 max-w-md mx-auto">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Check size={32} className="text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-primary-foreground mb-2">
                You're on the list!
              </h3>
              <p className="text-primary-foreground/80">
                Check your inbox for next steps. We'll be in touch soon with your early access details.
              </p>
            </div>
          ) : (
            <div className="max-w-xl mx-auto">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground text-primary placeholder:text-primary/50 text-lg focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    'Submitting...'
                  ) : (
                    <>
                      Start Scheduling Smarter
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>

              {/* Error message */}
              {status === 'error' && errorMessage && (
                <p className="text-primary-foreground/90 text-sm mb-4 bg-primary-foreground/10 py-2 px-4 rounded-lg">
                  {errorMessage}
                </p>
              )}

              {/* Supporting text */}
              <p className="text-primary-foreground/70 text-sm md:text-base">
                No credit card required • Free for 30 days
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
