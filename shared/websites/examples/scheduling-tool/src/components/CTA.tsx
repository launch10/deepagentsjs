import { useState, FormEvent } from 'react';
import { L10 } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRightToLine, Check, Sparkles } from 'lucide-react';

export function CTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
    <section id="cta" className="relative bg-primary py-20 md:py-24 lg:py-28 overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon accent */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>

          {/* Headline */}
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Save 15 Hours Per Week?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto">
            Join 2,000+ teams who've eliminated scheduling chaos. Start your free trial today.
          </p>

          {/* Form or Success State */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-8 border border-primary-foreground/20">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-primary-foreground mb-2">
                You're all set!
              </h3>
              <p className="text-primary-foreground/90">
                Check your inbox for next steps to start your free trial.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email input and button */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  className="flex-1 h-14 text-base bg-background text-foreground border-primary-foreground/20 focus-visible:ring-primary-foreground/50 placeholder:text-muted-foreground"
                  required
                />
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  size="lg"
                  className="h-14 px-8 bg-background text-primary hover:bg-background/90 hover:scale-105 transition-all duration-200 font-semibold text-base shadow-lg"
                >
                  {status === 'loading' ? (
                    'Starting...'
                  ) : (
                    <>
                      Get Started Free
                      <ArrowRightToLine className="w-5 h-5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {/* Error message */}
              {status === 'error' && errorMessage && (
                <p className="text-sm text-primary-foreground/90 bg-primary-foreground/10 rounded-lg py-2 px-4 max-w-xl mx-auto">
                  {errorMessage}
                </p>
              )}

              {/* Small print */}
              <p className="text-sm text-primary-foreground/70 mt-4">
                No credit card required • 14-day free trial
              </p>
            </form>
          )}

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-primary-foreground/60 text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Setup in 5 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
