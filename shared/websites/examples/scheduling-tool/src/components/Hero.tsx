import { useState } from 'react';
import { ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { L10 } from '@/lib/tracking';

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
    <section className="relative bg-primary text-primary-foreground py-20 md:py-24 lg:py-32 overflow-hidden">
      {/* Atmospheric gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-10">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Logo" 
              className="h-12 md:h-16 w-auto transition-transform duration-300 hover:scale-105"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 md:mb-8">
            Stop Playing Calendar Tetris{' '}
            <span className="inline-flex items-center gap-2">
              Across Time Zones
              <Calendar className="w-12 h-12 md:w-16 md:h-16 inline-block opacity-90 animate-bounce" 
                        style={{ animationDuration: '3s' }} />
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 mb-10 md:mb-12 max-w-3xl mx-auto leading-relaxed">
            Your distributed team deserves better than endless Slack threads about "when works for everyone?" 
            Connect calendars, share preferences, and let us find the perfect meeting time—instantly.
          </p>

          {/* Email capture form */}
          {status === 'success' ? (
            <div className="max-w-md mx-auto bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className="w-8 h-8 text-secondary animate-pulse" />
                <h3 className="text-2xl font-bold">You're on the list!</h3>
              </div>
              <p className="text-primary-foreground/80 text-lg">
                We'll be in touch soon with early access to smarter scheduling.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-6 py-4 rounded-xl text-lg bg-primary-foreground text-primary placeholder:text-primary/60 focus:outline-none focus:ring-4 focus:ring-secondary/50 transition-all duration-200 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="group px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    'Joining...'
                  ) : (
                    <>
                      Start Scheduling Smarter
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </button>
              </div>
              {status === 'error' && (
                <p className="mt-3 text-red-300 text-sm bg-red-500/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-red-400/30">
                  {errorMessage}
                </p>
              )}
            </form>
          )}

          {/* Social proof */}
          {status !== 'success' && (
            <p className="text-primary-foreground/70 text-sm md:text-base flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Join 2,000+ distributed teams
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
