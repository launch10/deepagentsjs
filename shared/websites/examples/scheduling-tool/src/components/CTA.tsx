import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <section className="relative bg-primary py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to Reclaim Your Time?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto">
            Join thousands of teams who've eliminated scheduling chaos. Get started in under 2 minutes.
          </p>

          {/* Form or Success State */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 md:p-12 max-w-2xl mx-auto">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                  You're All Set!
                </h3>
                <p className="text-primary-foreground/80 text-lg">
                  Check your inbox for next steps. We'll have you up and running in minutes.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Email Capture Form */}
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  className="flex-1 h-14 px-6 text-lg bg-primary-foreground text-primary border-0 focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={status === 'loading'}
                  className="h-14 px-8 text-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:scale-105 transition-all duration-200 font-semibold"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Start Free Trial
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              {/* Error Message */}
              {status === 'error' && errorMessage && (
                <div className="mb-6 p-4 bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg">
                  <p className="text-primary-foreground/90">{errorMessage}</p>
                </div>
              )}

              {/* Supporting Text */}
              <p className="text-primary-foreground/70 text-sm md:text-base">
                No credit card required • 14-day free trial
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
