import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { L10 } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Hero() {
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
    <section className="relative bg-primary overflow-hidden py-20 md:py-24 lg:py-32">
      {/* Atmospheric gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-primary-foreground/8 rounded-full blur-2xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-10">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
              alt="Logo" 
              className="max-w-24 md:max-w-32 animate-pulse"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 md:mb-8 leading-tight">
            Stop Playing Timezone Tetris
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-10 md:mb-12 leading-relaxed max-w-3xl mx-auto">
            Automatically find meeting times that work across continents. No more endless Slack threads asking{' '}
            <span className="text-primary-foreground font-semibold">"when works for everyone?"</span>
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="bg-primary-foreground/20 rounded-full p-2">
                  <Check className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-primary-foreground">You're in!</h3>
              </div>
              <p className="text-primary-foreground/80">
                We'll send you early access details soon. Get ready to schedule smarter.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className="flex-1 h-14 px-6 text-lg bg-primary-foreground/95 text-primary border-0 placeholder:text-primary/50 focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={status === 'loading'}
                  className="h-14 px-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:scale-105 transition-all duration-200 font-semibold text-lg group"
                >
                  {status === 'loading' ? (
                    'Joining...'
                  ) : (
                    <>
                      Start Scheduling Smarter
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
              {status === 'error' && (
                <p className="text-primary-foreground/90 text-sm mt-3 bg-primary-foreground/10 rounded-lg p-3 border border-primary-foreground/20">
                  {errorMessage}
                </p>
              )}
            </form>
          )}

          {/* Secondary text */}
          {status !== 'success' && (
            <p className="text-primary-foreground/70 text-sm md:text-base">
              Join 2,000+ distributed teams
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
