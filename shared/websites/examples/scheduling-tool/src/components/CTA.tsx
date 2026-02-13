import { useState } from 'react';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { L10 } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-foreground/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-foreground/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            Ready to End the Scheduling Chaos?
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-12">
            Join 2,000+ teams who've reclaimed their time.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 md:p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                  You're on the list!
                </h3>
                <p className="text-lg text-primary-foreground/80">
                  Check your inbox for next steps to start scheduling smarter.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  className="flex-1 h-14 px-6 text-lg bg-primary-foreground text-primary border-0 focus-visible:ring-2 focus-visible:ring-primary-foreground/50 rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  size="lg"
                  className="h-14 px-8 text-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:scale-105 transition-all duration-200 rounded-xl font-semibold shadow-lg hover:shadow-xl group"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Start Scheduling Smarter
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>

              {/* Error message */}
              {status === 'error' && errorMessage && (
                <p className="text-primary-foreground/90 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-lg px-4 py-3 text-sm">
                  {errorMessage}
                </p>
              )}

              {/* Supporting text */}
              <p className="text-primary-foreground/80 text-base md:text-lg">
                Free to start. No credit card required.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
