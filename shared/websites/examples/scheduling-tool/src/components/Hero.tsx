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
    <section id="hero" className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Copy */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Stop Playing Calendar Tetris Across Time Zones
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Your distributed team deserves better than endless "when works for everyone?" threads. Connect your calendars, set your preferences once, and get optimal meeting times instantly—no back-and-forth required.
            </p>

            {/* Email Capture Form */}
            {status === 'success' ? (
              <div className="bg-success/10 border border-success rounded-lg p-6 flex items-start space-x-3">
                <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-success-foreground">You're on the list!</p>
                  <p className="text-sm text-muted-foreground mt-1">We'll send you early access details soon.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className="flex-1 h-12 text-base"
                />
                <Button 
                  type="submit" 
                  disabled={status === 'loading'}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 whitespace-nowrap"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Get Early Access'
                  )}
                </Button>
              </form>
            )}

            {status === 'error' && (
              <p className="text-destructive text-sm mt-2 text-center lg:text-left">{errorMessage}</p>
            )}

            <p className="text-sm text-muted-foreground mt-4 text-center lg:text-left">
              Join 2,000+ distributed teams already saving time
            </p>
          </div>

          {/* Right Column - Image */}
          <div className="relative lg:block">
            <div className="relative rounded-lg overflow-hidden shadow-2xl">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="Scheduling dashboard showing time zone coordination"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
