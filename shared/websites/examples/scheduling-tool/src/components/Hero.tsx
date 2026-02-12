import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function Hero() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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
    <section className="relative w-full bg-primary overflow-hidden py-20 md:py-24 lg:py-32">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '6s', animationDelay: '1s' }} />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ 
               backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
               backgroundSize: '50px 50px'
             }} />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column - Copy and CTA */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight">
                Stop the Scheduling Chaos
              </h1>
              
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed max-w-2xl">
                Your distributed team deserves better than endless Slack threads about "when works for everyone?" 
                We find the perfect meeting time across all time zones—instantly.
              </p>
            </div>

            {/* Email capture form */}
            <div className="space-y-4">
              {status === 'success' ? (
                <div className="bg-background/95 backdrop-blur-sm rounded-2xl p-6 border border-primary-foreground/10 shadow-xl">
                  <div className="flex items-center gap-3 text-primary">
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-lg">You're on the list!</p>
                      <p className="text-sm text-muted-foreground">We'll be in touch soon with early access.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (status === 'error') setStatus('idle');
                        }}
                        placeholder="Enter your work email"
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-background/95 backdrop-blur-sm border border-primary-foreground/10 
                                 text-foreground placeholder:text-muted-foreground
                                 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent
                                 transition-all duration-200 shadow-lg"
                        disabled={status === 'loading'}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="group px-8 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold
                               hover:scale-105 hover:shadow-2xl active:scale-95
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                               transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Joining...</span>
                        </>
                      ) : (
                        <>
                          <span>Get Early Access</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                        </>
                      )}
                    </button>
                  </div>

                  {status === 'error' && errorMessage && (
                    <p className="text-sm text-destructive bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg">
                      {errorMessage}
                    </p>
                  )}
                </form>
              )}

              <p className="text-sm text-primary-foreground/70 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Join 2,000+ distributed teams
              </p>
            </div>
          </div>

          {/* Right column - Hero image */}
          <div className="relative lg:order-last">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl 
                          hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] 
                          transition-all duration-500 hover:-translate-y-2">
              <img
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
                alt="Scheduling tool interface showing time zone coordination"
                className="w-full h-auto"
              />
              
              {/* Subtle overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Decorative floating element */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-accent/20 rounded-full blur-2xl animate-pulse" 
                 style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
