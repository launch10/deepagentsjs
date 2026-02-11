import { useState } from 'react';
import { L10 } from '@/lib/tracking';
import { ArrowRight, Calendar, Sparkles } from 'lucide-react';

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
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-28 lg:py-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-10">
            <div className="relative">
              <img 
                src="https://r2-upload.launch10.workers.dev/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
                alt="Logo" 
                className="h-16 md:h-20 lg:h-24 w-auto animate-subtle-float"
              />
              <div className="absolute -inset-4 bg-primary-foreground/10 rounded-full blur-xl -z-10" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 md:mb-8 leading-tight tracking-tight">
            Stop Playing{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Calendar Tetris</span>
              <span className="absolute bottom-2 left-0 right-0 h-3 bg-secondary/40 -rotate-1" />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl lg:text-3xl text-primary-foreground/90 mb-10 md:mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            Automatically find meeting times that work across every time zone. No more endless Slack threads asking{' '}
            <span className="italic font-medium">"when works for everyone?"</span>
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="max-w-md mx-auto">
              <div className="bg-success/20 border-2 border-success/40 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-success rounded-full p-3">
                    <Sparkles className="w-6 h-6 text-success-foreground" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">You're on the list!</h3>
                <p className="text-primary-foreground/80">
                  We'll send you early access details soon. Get ready to say goodbye to calendar chaos.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground/95 text-foreground placeholder:text-muted-foreground border-2 border-transparent focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all duration-200 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="group px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-2xl hover:shadow-secondary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    'Joining...'
                  ) : (
                    <>
                      Get Early Access
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </button>
              </div>
              
              {status === 'error' && (
                <p className="text-destructive-foreground bg-destructive/20 border border-destructive/40 rounded-lg px-4 py-2 text-sm mb-3">
                  {errorMessage}
                </p>
              )}
            </form>
          )}

          {/* Supporting text */}
          {status !== 'success' && (
            <div className="flex items-center justify-center gap-2 text-primary-foreground/70">
              <Calendar className="w-4 h-4" />
              <p className="text-sm md:text-base">
                Join 2,000+ distributed teams
              </p>
            </div>
          )}

          {/* Decorative elements */}
          <div className="mt-16 md:mt-20 flex justify-center gap-8 md:gap-12 opacity-40">
            <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" style={{ animationDelay: '0.6s' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
