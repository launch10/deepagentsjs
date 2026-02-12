import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { L10 } from '@/lib/tracking';
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

export function Hero() {
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
    <section className="relative bg-primary text-primary-foreground overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs for depth */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl" 
             style={{ animationDelay: '1s' }} />
        
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{
               backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                                linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
               backgroundSize: '4rem 4rem'
             }} />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 md:px-6 py-20 md:py-24 lg:py-32">
        <div className="max-w-5xl mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-12">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
              alt="Logo" 
              className="h-16 md:h-20 w-auto animate-subtle-float"
            />
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-center mb-6 md:mb-8 leading-tight tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}>
            Stop Playing Calendar Tetris{' '}
            <span className="inline-block">
              <span className="relative">
                Across Time Zones
                <Sparkles className="absolute -top-2 -right-8 w-6 h-6 md:w-8 md:h-8 text-secondary animate-pulse" />
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 text-center mb-10 md:mb-12 max-w-3xl mx-auto leading-relaxed"
             style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Your distributed team deserves better than endless Slack threads about "when works for everyone?" 
            We find the perfect meeting time instantly—so you can focus on the work that matters.
          </p>

          {/* Email capture form */}
          <div className="max-w-xl mx-auto">
            {status === 'success' ? (
              <div className="bg-success/10 border-2 border-success/30 rounded-2xl p-6 md:p-8 text-center backdrop-blur-sm">
                <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-success mx-auto mb-4" />
                <h3 className="text-xl md:text-2xl font-semibold mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
                  You're on the list!
                </h3>
                <p className="text-primary-foreground/80" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  We'll send you early access details soon. Get ready to reclaim your time.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === 'loading'}
                    className="flex-1 h-12 md:h-14 text-base md:text-lg bg-primary-foreground/95 text-foreground border-primary-foreground/20 placeholder:text-muted-foreground focus-visible:ring-secondary focus-visible:ring-offset-primary"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <Button
                    type="submit"
                    disabled={status === 'loading'}
                    size="lg"
                    className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl group"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {status === 'loading' ? (
                      'Joining...'
                    ) : (
                      <>
                        Get Early Access
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>

                {status === 'error' && errorMessage && (
                  <p className="text-sm md:text-base text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 text-center"
                     style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {errorMessage}
                  </p>
                )}

                {status === 'idle' && (
                  <p className="text-sm md:text-base text-primary-foreground/70 text-center flex items-center justify-center gap-2"
                     style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    <CheckCircle className="w-4 h-4" />
                    Join 2,000+ teams saving 15 hours per week
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Decorative elements */}
          <div className="mt-16 md:mt-20 flex justify-center gap-8 md:gap-12 opacity-40">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>2,000+</div>
              <div className="text-xs md:text-sm text-primary-foreground/70" style={{ fontFamily: "'DM Sans', sans-serif" }}>Teams</div>
            </div>
            <div className="w-px bg-primary-foreground/20" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>15hrs</div>
              <div className="text-xs md:text-sm text-primary-foreground/70" style={{ fontFamily: "'DM Sans', sans-serif" }}>Saved/Week</div>
            </div>
            <div className="w-px bg-primary-foreground/20" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>50+</div>
              <div className="text-xs md:text-sm text-primary-foreground/70" style={{ fontFamily: "'DM Sans', sans-serif" }}>Time Zones</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
