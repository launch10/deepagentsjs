import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { L10 } from '@/lib/tracking';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function CTA() {
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
    <section id="cta" className="py-16 sm:py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Stop wasting hours on scheduling—start in 60 seconds
          </h2>
          <p className="text-lg sm:text-xl mb-8 text-primary-foreground/90">
            Join thousands of teams who've eliminated the back-and-forth and reclaimed their time for work that actually matters.
          </p>

          {/* Email Capture Form */}
          {status === 'success' ? (
            <div className="bg-success/20 border border-success/30 rounded-lg p-6 flex items-start space-x-3 max-w-md mx-auto">
              <CheckCircle2 className="h-6 w-6 text-success-foreground flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold text-primary-foreground">You're on the list!</p>
                <p className="text-sm text-primary-foreground/80 mt-1">We'll send you early access details soon.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                className="flex-1 h-12 text-base bg-background text-foreground"
              />
              <Button 
                type="submit" 
                disabled={status === 'loading'}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 px-8 whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Get Early Access Free'
                )}
              </Button>
            </form>
          )}

          {status === 'error' && (
            <p className="text-destructive-foreground bg-destructive/20 rounded px-4 py-2 text-sm mt-3 inline-block">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
