import { useState } from 'react';
import { ArrowRight, Clock, Globe2, Sparkles } from 'lucide-react';
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
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs for depth */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        
        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] opacity-20">
          <Clock className="w-12 h-12 animate-float" style={{ animationDuration: '6s' }} />
        </div>
        <div className="absolute top-40 right-[15%] opacity-20">
          <Globe2 className="w-16 h-16 animate-float" style={{ animationDuration: '8s', animationDelay: '1s' }} />
        </div>
        <div className="absolute bottom-32 left-[20%] opacity-20">
          <Sparkles className="w-10 h-10 animate-float" style={{ animationDuration: '7s', animationDelay: '2s' }} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column: Copy and CTA */}
          <div className="space-y-8 lg:space-y-10">
            {/* Headline */}
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
                Stop Playing{' '}
                <span className="inline-block relative">
                  <span className="relative z-10">Timezone Tetris</span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-secondary/40 -rotate-1" />
                </span>
              </h1>
              
              <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 leading-relaxed max-w-2xl">
                Automatically find meeting times that work across continents. No more endless Slack threads asking "when works for everyone?"
              </p>
            </div>

            {/* Email capture form */}
            <div className="space-y-4">
              {status === 'success' ? (
                <div className="bg-success/20 border-2 border-success/40 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-success rounded-full flex items-center justify-center mt-0.5">
                      <ArrowRight className="w-4 h-4 text-success-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">You're on the list!</p>
                      <p className="text-primary-foreground/80 mt-1">We'll send you early access details soon.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      disabled={status === 'loading'}
                      className="flex-1 px-6 py-4 rounded-xl bg-primary-foreground/95 text-foreground placeholder:text-muted-foreground border-2 border-transparent focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all duration-200 text-lg disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="group px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold text-lg hover:scale-105 hover:shadow-2xl hover:shadow-secondary/20 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {status === 'loading' ? (
                        'Joining...'
                      ) : (
                        <>
                          Get Started Free
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                        </>
                      )}
                    </button>
                  </div>
                  
                  {status === 'error' && (
                    <p className="text-destructive-foreground bg-destructive/20 border border-destructive/40 rounded-lg px-4 py-2 text-sm">
                      {errorMessage}
                    </p>
                  )}
                </form>
              )}

              {/* Supporting text */}
              <p className="text-primary-foreground/70 text-sm md:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Join 2,000+ distributed teams
              </p>
            </div>
          </div>

          {/* Right column: Rocket logo with creative positioning */}
          <div className="relative lg:block hidden">
            <div className="relative">
              {/* Decorative background circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-br from-secondary/30 via-accent/20 to-transparent blur-2xl animate-pulse-subtle" />
              </div>
              
              {/* Rocket image with floating animation */}
              <div className="relative z-10 animate-float" style={{ animationDuration: '5s' }}>
                <img
                  src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                  alt="Rocket"
                  className="w-full max-w-md mx-auto drop-shadow-2xl"
                />
              </div>

              {/* Orbiting decorative elements */}
              <div className="absolute top-1/4 -left-8 w-20 h-20 bg-secondary/30 rounded-full blur-xl animate-float" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
              <div className="absolute bottom-1/4 -right-8 w-16 h-16 bg-accent/30 rounded-full blur-xl animate-float" style={{ animationDuration: '5s', animationDelay: '1.5s' }} />
            </div>
          </div>

          {/* Mobile rocket - smaller, centered */}
          <div className="lg:hidden flex justify-center">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 via-accent/20 to-transparent rounded-full blur-2xl animate-pulse-subtle" />
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Rocket"
                className="relative z-10 w-full h-full object-contain drop-shadow-2xl animate-subtle-float"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/0 to-transparent" />
    </section>
  );
}
