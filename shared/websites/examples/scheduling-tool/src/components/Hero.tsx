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
                Stop Playing
                <span className="block text-secondary mt-2">Timezone Tetris</span>
              </h1>
              
              <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 leading-relaxed max-w-2xl">
                Automatically find meeting times that work across continents. No more endless Slack threads asking "when works for everyone?"
              </p>
            </div>

            {/* Email capture form */}
            {status === 'success' ? (
              <div className="bg-success/20 border-2 border-success/40 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-success rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-success-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">You're on the list!</h3>
                    <p className="text-primary-foreground/80">
                      We'll send you early access details soon. Get ready to say goodbye to timezone chaos.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={status === 'loading'}
                    className="flex-1 px-6 py-4 md:py-5 text-base md:text-lg rounded-xl md:rounded-2xl bg-primary-foreground/95 text-foreground placeholder:text-muted-foreground border-2 border-transparent focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all duration-200 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="group px-8 py-4 md:py-5 text-base md:text-lg font-semibold rounded-xl md:rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
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
                </form>

                {status === 'error' && (
                  <div className="bg-destructive/20 border border-destructive/40 rounded-xl p-4 text-sm">
                    {errorMessage}
                  </div>
                )}

                <p className="text-sm md:text-base text-primary-foreground/70 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Join 2,000+ distributed teams
                </p>
              </div>
            )}
          </div>

          {/* Right column: Rocket logo with creative positioning */}
          <div className="relative lg:block hidden">
            <div className="relative">
              {/* Decorative background circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-br from-secondary/30 via-accent/20 to-transparent blur-2xl animate-pulse-subtle" />
              </div>
              
              {/* Rocket logo with floating animation */}
              <div className="relative z-10 flex items-center justify-center animate-float" style={{ animationDuration: '5s' }}>
                <div className="relative">
                  {/* Glow effect behind logo */}
                  <div className="absolute inset-0 bg-secondary/40 rounded-full blur-3xl scale-150" />
                  
                  {/* Logo */}
                  <img
                    src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                    alt="Rocket"
                    className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 object-contain drop-shadow-2xl"
                  />
                  
                  {/* Sparkle accents around logo */}
                  <div className="absolute -top-4 -right-4 w-8 h-8 bg-secondary rounded-full animate-ping opacity-75" />
                  <div className="absolute -bottom-6 -left-6 w-6 h-6 bg-accent rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile rocket logo */}
          <div className="lg:hidden flex justify-center">
            <div className="relative animate-subtle-float" style={{ animationDuration: '4s' }}>
              <div className="absolute inset-0 bg-secondary/30 rounded-full blur-2xl scale-150" />
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Rocket"
                className="relative w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/0 to-transparent pointer-events-none" />
    </section>
  );
}
