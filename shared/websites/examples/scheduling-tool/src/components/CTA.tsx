import { useState } from 'react';
import { L10 } from '@/lib/tracking';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';

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
    <section className="relative bg-primary py-20 md:py-24 lg:py-28 overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 md:px-6 text-center">
        {status === 'success' ? (
          // Success state
          <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="space-y-3">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">
                You're All Set!
              </h2>
              <p className="text-xl md:text-2xl text-primary-foreground/90">
                Check your inbox for next steps to get started
              </p>
            </div>
          </div>
        ) : (
          // Default state
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight">
                Ready to End Scheduling Chaos?
              </h2>
              <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-2xl mx-auto">
                Join thousands of teams who've reclaimed their time
              </p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="Enter your email"
                  className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground text-foreground placeholder:text-muted-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary-foreground/50 transition-all"
                  disabled={status === 'loading'}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing up...</span>
                    </>
                  ) : (
                    <>
                      <span>Get Started Free</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {status === 'error' && errorMessage && (
                <p className="text-sm text-primary-foreground/90 bg-primary-foreground/10 px-4 py-2 rounded-lg">
                  {errorMessage}
                </p>
              )}

              <p className="text-sm text-primary-foreground/80">
                No credit card required • 14-day free trial
              </p>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
