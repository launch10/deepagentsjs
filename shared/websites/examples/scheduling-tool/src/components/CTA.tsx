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
    <section className="py-24 bg-accent text-accent-foreground">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">
              Stop the scheduling chaos. Start today.
            </h2>
            <p className="text-xl text-accent-foreground/90">
              Join in 60 seconds—no credit card, no time zone math required.
            </p>
          </div>

          {status === 'success' ? (
            <div className="bg-success/20 border border-success/30 rounded-lg p-6 flex items-start gap-3 max-w-md mx-auto">
              <CheckCircle2 className="w-6 h-6 text-success-foreground flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold text-success-foreground">Welcome aboard!</p>
                <p className="text-sm text-success-foreground/80 mt-1">Check your inbox for next steps.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                className="flex-1 bg-background text-foreground"
              />
              <Button 
                type="submit" 
                size="lg"
                disabled={status === 'loading'}
                className="bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Get Started Free'
                )}
              </Button>
            </form>
          )}

          {status === 'error' && (
            <p className="text-sm text-destructive-foreground bg-destructive/20 border border-destructive/30 rounded p-3 max-w-md mx-auto">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
