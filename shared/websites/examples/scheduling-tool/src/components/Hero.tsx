import { useState, FormEvent } from 'react';
import { L10 } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRightToLine, CheckCheck, CalendarClock } from 'lucide-react';

export function Hero() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email');
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
    <section className="relative bg-primary text-primary-foreground overflow-hidden py-20 md:py-24 lg:py-32">
      {/* Atmospheric gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-foreground/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary-foreground/10 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column: Copy and CTA */}
          <div className="space-y-8">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
              <CalendarClock className="w-4 h-4" />
              <span className="text-sm font-medium">Join 2,000+ distributed teams</span>
            </div>

            {/* Headline */}
            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
              Stop the Scheduling Chaos
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed max-w-2xl">
              Automatically find meeting times across time zones. No more endless Slack threads asking{' '}
              <span className="font-semibold text-primary-foreground">"when works for everyone?"</span>
            </p>

            {/* Email capture form */}
            {status === 'success' ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 backdrop-blur-sm">
                <CheckCheck className="w-6 h-6 text-primary-foreground flex-shrink-0" />
                <div>
                  <p className="font-semibold text-lg">You're on the list!</p>
                  <p className="text-sm text-primary-foreground/80">We'll be in touch soon with early access.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === 'loading'}
                    className="flex-1 h-12 text-base bg-background text-foreground border-primary-foreground/20 focus-visible:ring-primary-foreground/50"
                    required
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={status === 'loading'}
                    className="h-12 px-8 bg-background text-primary hover:bg-background/90 hover:scale-105 transition-all duration-200 font-semibold shadow-lg"
                  >
                    {status === 'loading' ? (
                      'Submitting...'
                    ) : (
                      <>
                        Start Scheduling Smarter
                        <ArrowRightToLine className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
                {status === 'error' && errorMessage && (
                  <p className="text-sm text-primary-foreground/90 bg-primary-foreground/10 px-4 py-2 rounded-md border border-primary-foreground/20">
                    {errorMessage}
                  </p>
                )}
              </form>
            )}

            {/* Additional trust element */}
            <p className="text-sm text-primary-foreground/70">
              Free 14-day trial • No credit card required • Cancel anytime
            </p>
          </div>

          {/* Right column: Hero image */}
          <div className="relative lg:order-last">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/10 backdrop-blur-sm transform hover:scale-[1.02] transition-transform duration-300">
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Scheduling tool interface showing automatic meeting time finder"
                className="w-full h-auto"
              />
              {/* Subtle overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
            </div>
            
            {/* Decorative element */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
