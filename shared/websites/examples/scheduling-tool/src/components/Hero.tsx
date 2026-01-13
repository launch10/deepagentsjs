import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { L10 } from '@/lib/tracking';
import { CheckCircle2, Loader2 } from 'lucide-react';

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
    <section id="hero" className="relative min-h-screen flex items-center justify-center bg-primary text-primary-foreground pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Stop Playing Calendar Tetris Across Time Zones
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed">
                Your distributed team deserves better than endless "when works for everyone?" messages. Connect your calendars, set your preferences, and get optimal meeting times instantly—no back-and-forth required.
              </p>
            </div>

            {status === 'success' ? (
              <div className="bg-success/20 border border-success/30 rounded-lg p-6 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-success-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-success-foreground">You're on the list!</p>
                  <p className="text-sm text-success-foreground/80 mt-1">We'll be in touch soon with early access.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className="flex-1 bg-background text-foreground border-primary-foreground/20 focus:border-primary-foreground/40"
                />
                <Button 
                  type="submit" 
                  size="lg"
                  disabled={status === 'loading'}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Find Your Perfect Time'
                  )}
                </Button>
              </form>
            )}

            {status === 'error' && (
              <p className="text-sm text-destructive-foreground bg-destructive/20 border border-destructive/30 rounded p-3">
                {errorMessage}
              </p>
            )}

            <p className="text-sm text-primary-foreground/70">
              Join 2,000+ teams who've cut scheduling time by 80%.
            </p>
          </div>

          <div className="hidden lg:block">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
              alt="Scheduling Dashboard"
              className="w-full h-auto rounded-lg shadow-2xl animate-subtle-float"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
