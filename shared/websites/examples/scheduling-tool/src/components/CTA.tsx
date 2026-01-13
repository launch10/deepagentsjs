import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCheck } from 'lucide-react';
import { L10 } from '@/lib/tracking';

export function CTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      await L10.createLead(email);
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="relative py-20 md:py-24 lg:py-28 bg-primary text-primary-foreground overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#264653] via-primary to-[#2A9D8F]" />
      
      {/* Decorative circles */}
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-[#E9C46A] opacity-10 blur-3xl" />
      <div className="absolute bottom-10 left-10 w-80 h-80 rounded-full bg-[#F4A261] opacity-10 blur-3xl" />

      <div className="container relative z-10 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Stop Wasting Time on{' '}
            <span className="text-[#E9C46A]">Meeting Coordination</span> Today
          </h2>
          
          <p className="text-lg md:text-xl mb-10 text-primary-foreground/90 leading-relaxed">
            Join thousands of distributed teams who've reclaimed hours every week with effortless scheduling that just works.
          </p>

          {status === 'success' ? (
            <div className="max-w-md mx-auto bg-[#2A9D8F] text-white p-8 rounded-3xl shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                <CheckCheck className="w-8 h-8" />
              </div>
              <p className="text-xl font-semibold mb-2">Welcome aboard! 🎉</p>
              <p className="text-sm opacity-90">Check your inbox for early access details.</p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="max-w-lg mx-auto mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 h-14 px-6 text-base bg-white text-foreground border-0 focus-visible:ring-2 focus-visible:ring-[#E9C46A]"
                    disabled={status === 'loading'}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={status === 'loading'}
                    className="h-14 px-8 bg-[#E76F51] hover:bg-[#E76F51]/90 text-white font-semibold text-base transition-all hover:scale-105 shadow-lg"
                  >
                    {status === 'loading' ? 'Joining...' : 'Get Early Access Free'}
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-[#E76F51] bg-white/90 px-4 py-2 rounded-lg mt-3">{error}</p>
                )}
              </form>

              <p className="text-sm text-primary-foreground/70">
                No credit card required. Setup in 60 seconds.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
